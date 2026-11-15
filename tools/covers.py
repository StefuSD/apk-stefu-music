#!/usr/bin/env python3
"""Find and embed cover art into MP3 files that have none.

Usage:
  python covers.py [--dry-run] [--limit N] [--log PATH] FOLDER [FOLDER ...]
  python covers.py --undo [--log PATH]

For every MP3 (recursive) without an APIC frame: artist + title from ID3
(fallback: file name "Artist - Title.mp3"), search Deezer, then iTunes
(iTunes throttles to ~20 req/min, so it is the fallback, 3 s apart).
A result is accepted only if the normalized artist AND title match
(difflib ratio >= 0.8 or containment). The artwork (JPEG/PNG checked by magic
bytes) is embedded as APIC type 3 (front cover), tags saved as ID3v2.3.
Audio data and other frames are not touched.

Log CSV (default D:\\music\\covers-log.csv): file, artist, title, source,
matched_artist, matched_title, status, size0, size1.
status: embedded | match (dry run) | not_found | skipped | error | undone.
size0 = file size before embedding (used by sound.py), size1 = after.
--undo removes APIC frames from files whose log status is "embedded".
"""
import argparse
import csv
import difflib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import urllib.error

from mutagen.id3 import ID3, APIC, ID3NoHeaderError

UA = "StefuMusic-tools/1.0"
DEFAULT_LOG = r"D:\music\covers-log.csv"
FIELDS = ["file", "artist", "title", "source", "matched_artist", "matched_title",
          "status", "size0", "size1"]

# ---------------------------------------------------------------- HTTP

_last = {}
_interval = {"itunes.apple.com": 3.0, "api.deezer.com": 0.4}
_cooldown = {}  # host -> time until which it is skipped


def http_get(url, binary=False, tries=5):
    host = urllib.parse.urlparse(url).hostname or ""
    for attempt in range(tries):
        gap = _interval.get(host, 0.0) - (time.time() - _last.get(host, 0))
        if gap > 0:
            time.sleep(gap)
        _last[host] = time.time()
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                data = r.read()
            return data if binary else json.loads(data.decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and host == "itunes.apple.com" and 1 <= attempt < tries - 1:
                print(f"    HTTP {e.code} from {host}, waiting 60s", flush=True)
                time.sleep(60)
                continue
            if e.code in (403, 429) and host == "itunes.apple.com" and attempt >= 1:
                # iTunes throttles hard (~20 req/min): rest it, Deezer covers meanwhile
                _cooldown[host] = time.time() + 120
                print(f"    HTTP {e.code} from {host}, skipping it for 120s", flush=True)
                return None
            if e.code in (403, 429, 500, 502, 503) and attempt < tries - 1:
                wait = 5 * (2 ** attempt)
                if host in _interval:  # slow down for the rest of the run
                    _interval[host] = min(_interval[host] * 2, 4.0)
                print(f"    HTTP {e.code} from {host}, waiting {wait}s", flush=True)
                time.sleep(wait)
                continue
            if e.code == 404:
                return None
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < tries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise
    return None

# ---------------------------------------------------------------- matching

_FEAT = re.compile(r"\s*[\(\[]?\s*\b(feat\.?|ft\.?|featuring)\s.*$", re.I)
_BRACK = re.compile(r"[\(\[\{][^\)\]\}]*[\)\]\}]")
_DASHTAIL = re.compile(
    r"\s+-\s+.*\b(remaster\w*|version|edit|mix|live|mono|stereo|single|radio|"
    r"acoustic|demo|from|original|bonus|deluxe|instrumental)\b.*$", re.I)
_ART_SPLIT = re.compile(r"\s*(?:·|&|,|;|/|\+|\band\b|\bx\b|\bvs\.?|\bfeat\.?|\bft\.?|"
                        r"\bfeaturing\b|\bwith\b|\bи\b)\s*", re.I)


def fold(s):
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.casefold().replace("ё", "е").replace("ø", "o").replace("æ", "ae")
    s = s.replace("’", "'").replace("`", "'")
    return s


def norm_title(s):
    s = fold(s)
    s = _DASHTAIL.sub("", s)
    s = _BRACK.sub(" ", s)
    s = _FEAT.sub("", s)
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def norm_artist_one(s):
    s = fold(s)
    s = _BRACK.sub(" ", s)
    s = re.sub(r"[^\w\s]", "", s)
    s = re.sub(r"^the\s+", "", s.strip())
    return re.sub(r"\s+", " ", s).strip()


def split_artists(s):
    s = fold(s)
    parts = [norm_artist_one(p) for p in _ART_SPLIT.split(s)]
    whole = norm_artist_one(s)
    out = [p for p in parts if len(p) >= 2]
    if whole and whole not in out:
        out.append(whole)
    return out


def similar(a, b):
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    r = difflib.SequenceMatcher(None, a, b).ratio()
    short, long_ = sorted((a, b), key=len)
    # containment on word boundaries, the short side must be substantial
    if len(short) >= 4 and len(short) >= 0.5 * len(long_) and \
            re.search(r"(^|\s)" + re.escape(short) + r"($|\s)", long_):
        r = max(r, 0.85)
    return r


def artist_score(ours, theirs):
    a, b = split_artists(ours), split_artists(theirs)
    return max((similar(x, y) for x in a for y in b), default=0.0)


def title_score(ours, theirs):
    return similar(norm_title(ours), norm_title(theirs))


def best_match(artist, title, candidates, thr=0.8):
    best = None
    for c in candidates:
        sa = artist_score(artist, c["artist"])
        st = title_score(title, c["title"])
        if sa >= thr and st >= thr:
            score = sa + st + (0.05 if not c.get("compilation") else 0)
            if best is None or score > best[0]:
                best = (score, c)
    return best[1] if best else None

# ---------------------------------------------------------------- sources


def first_artist(a):
    parts = [p for p in re.split(r"\s*(?:·|&|,|;|/|\bfeat\.?|\bft\.?)\s*", a, flags=re.I) if p]
    return parts[0] if parts else a


def search_itunes(artist, title):
    if time.time() < _cooldown.get("itunes.apple.com", 0):
        return []
    term = f"{first_artist(artist)} {norm_title(title) or title}"
    url = "https://itunes.apple.com/search?" + urllib.parse.urlencode(
        {"term": term, "entity": "song", "limit": 5})
    data = http_get(url)
    out = []
    for r in (data or {}).get("results", []):
        art = r.get("artworkUrl100")
        if not art:
            continue
        out.append({"artist": r.get("artistName", ""), "title": r.get("trackName", ""),
                    "cover": art.replace("100x100bb", "600x600bb"),
                    "compilation": r.get("collectionArtistName") == "Various Artists"})
    return out


def search_deezer(artist, title):
    q = f'artist:"{first_artist(artist)}" track:"{norm_title(title) or title}"'
    url = "https://api.deezer.com/search?" + urllib.parse.urlencode({"q": q, "limit": 10})
    data = http_get(url)
    rows = (data or {}).get("data", []) if isinstance(data, dict) else []
    if not rows:  # plain query as a second chance
        url = "https://api.deezer.com/search?" + urllib.parse.urlencode(
            {"q": f"{first_artist(artist)} {title}", "limit": 10})
        data = http_get(url)
        rows = (data or {}).get("data", []) if isinstance(data, dict) else []
    out = []
    for r in rows:
        alb = r.get("album") or {}
        cover = alb.get("cover_xl") or alb.get("cover_big")
        if not cover:
            continue
        out.append({"artist": (r.get("artist") or {}).get("name", ""),
                    "title": r.get("title", ""), "cover": cover})
    return out


def image_mime(data):
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    return None

# ---------------------------------------------------------------- files


def artist_title(path, tags):
    artist = str(tags.get("TPE1", "")).strip() if tags else ""
    title = str(tags.get("TIT2", "")).strip() if tags else ""
    if not artist or not title:
        stem = os.path.splitext(os.path.basename(path))[0]
        if " - " in stem:
            a, t = stem.split(" - ", 1)
            artist = artist or a.strip()
            title = title or t.strip()
        else:
            title = title or stem
    return artist, title


def list_mp3(folders):
    for folder in folders:
        for root, dirs, files in os.walk(folder):
            dirs.sort()
            for f in sorted(files):
                if f.lower().endswith(".mp3"):
                    yield os.path.abspath(os.path.join(root, f))


def load_log(path):
    rows = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh):
                rows[r["file"]] = r
    return rows


def save_log(path, rows):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for r in rows.values():
            w.writerow({k: r.get(k, "") for k in FIELDS})
    os.replace(tmp, path)


def undo(log_path):
    rows = load_log(log_path)
    n = 0
    for f, r in rows.items():
        if r.get("status") != "embedded":
            continue
        if not os.path.exists(f):
            print("missing:", f)
            continue
        tags = ID3(f)
        if tags.getall("APIC"):
            tags.delall("APIC")
            tags.save(f, v2_version=3)
        r["status"] = "undone"
        r["size1"] = os.path.getsize(f)
        n += 1
    save_log(log_path, rows)
    print(f"APIC removed from {n} files")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folders", nargs="*")
    ap.add_argument("--dry-run", action="store_true", help="only report matches")
    ap.add_argument("--limit", type=int, default=0, help="process at most N files without cover")
    ap.add_argument("--log", default=DEFAULT_LOG)
    ap.add_argument("--undo", action="store_true", help="remove APIC from files logged as embedded")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    if args.undo:
        undo(args.log)
        return
    if not args.folders:
        ap.error("give at least one folder")

    rows = load_log(args.log)
    counts = {}
    done = 0
    for path in list_mp3(args.folders):
        try:
            tags = ID3(path)
        except ID3NoHeaderError:
            tags = ID3()
        artist, title = artist_title(path, tags)
        prev = rows.get(path)
        if tags.getall("APIC"):
            counts["skipped"] = counts.get("skipped", 0) + 1
            if not prev:
                rows[path] = {"file": path, "artist": artist, "title": title, "status": "skipped",
                              "size0": os.path.getsize(path), "size1": os.path.getsize(path)}
            continue
        if args.limit and done >= args.limit:
            break
        done += 1
        row = {"file": path, "artist": artist, "title": title, "source": "",
               "matched_artist": "", "matched_title": "", "status": "not_found",
               "size0": os.path.getsize(path), "size1": ""}
        try:
            match, source = None, ""
            if artist and title:
                match = best_match(artist, title, search_deezer(artist, title))
                source = "deezer"
                if not match:
                    match = best_match(artist, title, search_itunes(artist, title))
                    source = "itunes"
            if match:
                row.update(source=source, matched_artist=match["artist"], matched_title=match["title"])
                if args.dry_run:
                    row["status"] = "match"
                else:
                    img = http_get(match["cover"], binary=True)
                    mime = image_mime(img or b"")
                    if not mime:
                        row["status"] = "error"
                        row["source"] += " (bad image)"
                    else:
                        tags.delall("APIC")
                        tags.add(APIC(encoding=0, mime=mime, type=3, desc="", data=img))
                        tags.save(path, v2_version=3)
                        row["status"] = "embedded"
                        row["size1"] = os.path.getsize(path)
        except Exception as e:  # keep going on network/tag errors
            row["status"] = "error"
            row["source"] = (row["source"] + f" {type(e).__name__}: {e}")[:200]
        counts[row["status"]] = counts.get(row["status"], 0) + 1
        mark = {"embedded": "+", "match": "~", "not_found": "-", "error": "!"}[row["status"]]
        print(f"{mark} {artist} - {title}  =>  {row['source']}: {row['matched_artist']} - {row['matched_title']}",
              flush=True)
        if not args.dry_run:
            # never overwrite an earlier "embedded" record (it holds size0)
            if not (prev and prev.get("status") == "embedded"):
                rows[path] = row
            save_log(args.log, rows)
    if not args.dry_run:
        save_log(args.log, rows)
    print("counts:", json.dumps(counts))


if __name__ == "__main__":
    main()
