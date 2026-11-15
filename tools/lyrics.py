"""
Слова песен в MP3 — для своей библиотеки на компьютере.

Ищет слова в открытой базе LRCLIB (https://lrclib.net) по исполнителю,
названию и длительности и вшивает их в файл:
  • USLT — обычный текст (его читает Stefu Music при добавлении песни);
  • SYLT — строки со временем, если в базе есть синхронизированный текст.
Берёт только точное совпадение: исполнитель и название (без регистра,
скобок, «feat.») и длительность ±2 с. Звук и остальные теги не меняются.

  python tools/lyrics.py --dry-run --limit 20 D:\\music\\music-list
  python tools/lyrics.py D:\\music\\music-list D:\\music\\new-3
  python tools/lyrics.py --undo          # убрать вшитое по журналу

Журнал: D:\\music\\lyrics-log.csv (file, artist, title, status, lines, synced).
Файлы, где слова уже есть (USLT), пропускаются.
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request
from mutagen.id3 import ID3, USLT, SYLT, ID3NoHeaderError
from mutagen.mp3 import MP3

UA = 'StefuMusic-tools/1.0'
LOG = r'D:\music\lyrics-log.csv'


def norm(s):
    s = (s or '').lower()
    s = re.sub(r'\(.*?\)|\[.*?\]', ' ', s)
    s = re.sub(r'\s(feat|ft|featuring)\.?\s.*$', ' ', s)
    return re.sub(r'[^\w]+', ' ', s).strip()


def split_name(base):
    base = re.sub(r'^(?:\d{1,3}\.\s*|0\d\s+)', '', base).strip()
    m = re.match(r'^(.+?)\s+[-–—]\s+(.+)$', base)
    return (m.group(1).strip(), m.group(2).strip()) if m else ('', base)


def tags_of(path):
    try:
        t = ID3(path)
    except ID3NoHeaderError:
        t = None
    artist = str(t.get('TPE1')) if t and t.get('TPE1') else ''
    title = str(t.get('TIT2')) if t and t.get('TIT2') else ''
    a2, t2 = split_name(os.path.splitext(os.path.basename(path))[0])
    if not title:
        title, artist = t2, artist or a2
    if not artist:
        a3, t3 = split_name(title)
        if a3:
            artist, title = a3, t3
        else:
            artist = a2
    has = bool(t and t.getall('USLT'))
    return artist, title, has


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 503):
                time.sleep(5 * (attempt + 1)); continue
            raise
        except Exception:
            time.sleep(2 * (attempt + 1))
    return None


def find(artist, title, dur):
    """Лучшая запись LRCLIB или None: точный запрос, затем поиск."""
    first = artist.split('·')[0].split(',')[0].split('&')[0].strip()
    q = {'artist_name': first, 'track_name': title, 'duration': int(round(dur))}
    r = get('https://lrclib.net/api/get?' + urllib.parse.urlencode(q))
    cands = [r] if r else []
    if not cands:
        r = get('https://lrclib.net/api/search?' + urllib.parse.urlencode({'artist_name': first, 'track_name': title}))
        cands = r or []
    na, nt = norm(first), norm(title)
    best = None
    for c in cands:
        if not c or c.get('instrumental'):
            continue
        ca, ct = norm(c.get('artistName')), norm(c.get('trackName'))
        if not (na and (na in ca or ca in na)) or not (nt and (nt == ct or nt in ct or ct in nt)):
            continue
        if dur and c.get('duration') and abs(c['duration'] - dur) > 2:
            continue
        if not (c.get('plainLyrics') or c.get('syncedLyrics')):
            continue
        if best is None or (c.get('syncedLyrics') and not best.get('syncedLyrics')):
            best = c
    return best


def parse_lrc(lrc):
    out = []
    for line in (lrc or '').splitlines():
        stamps = re.findall(r'\[(\d+):(\d+(?:\.\d+)?)\]', line)
        text = re.sub(r'\[[^\]]*\]', '', line).strip()
        for mm, ss in stamps:
            out.append((int((int(mm) * 60 + float(ss)) * 1000), text))
    return sorted(out)


def sylt_frames(synced):
    # mutagen SYLT: список (текст, время в мс)
    return [(text, ms) for ms, text in synced]


def embed(path, rec):
    try:
        t = ID3(path)
    except ID3NoHeaderError:
        t = ID3()
    plain = (rec.get('plainLyrics') or '').strip()
    synced = parse_lrc(rec.get('syncedLyrics'))
    if not plain and synced:
        plain = '\n'.join(x for _, x in synced)
    t.delall('USLT')
    t.add(USLT(encoding=3, lang='XXX', desc='', text=plain))
    if synced:
        t.delall('SYLT')
        t.add(SYLT(encoding=3, lang='XXX', format=2, type=1, desc='', text=sylt_frames(synced)))
    t.save(path, v2_version=3)
    return len(plain.splitlines()), bool(synced)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('folders', nargs='*')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--undo', action='store_true')
    ap.add_argument('--sample', type=int, default=0, help='случайные N файлов (для пробы)')
    a = ap.parse_args()
    if a.undo:
        n = 0
        for row in csv.DictReader(open(LOG, encoding='utf-8')):
            if row['status'] == 'embedded' and os.path.exists(row['file']):
                t = ID3(row['file']); t.delall('USLT'); t.delall('SYLT'); t.save(row['file'], v2_version=3); n += 1
        print('removed from', n, 'files'); return
    files = []
    for d in a.folders:
        for root, _, fs in os.walk(d):
            files += [os.path.join(root, f) for f in sorted(fs) if f.lower().endswith('.mp3')]
    if a.sample:
        import random; random.seed(13); files = random.sample(files, min(a.sample, len(files)))
    if a.limit:
        files = files[:a.limit]
    rows, stat = [], {}
    for i, f in enumerate(files, 1):
        artist, title, has = tags_of(f)
        st, lines, syn = '', 0, False
        if has:
            st = 'has_lyrics'
        elif not artist or not title:
            st = 'no_artist'
        else:
            try:
                dur = MP3(f).info.length
                rec = find(artist, title, dur)
                if not rec:
                    st = 'not_found'
                elif a.dry_run:
                    st = 'found'; lines = len((rec.get('plainLyrics') or rec.get('syncedLyrics') or '').splitlines()); syn = bool(rec.get('syncedLyrics'))
                else:
                    lines, syn = embed(f, rec); st = 'embedded'
            except Exception as e:
                st = 'error:' + type(e).__name__
            time.sleep(0.3)
        stat[st] = stat.get(st, 0) + 1
        rows.append({'file': f, 'artist': artist, 'title': title, 'status': st, 'lines': lines, 'synced': int(syn)})
        print(f'{i}/{len(files)} {st:10} {"synced" if syn else "      "} {artist} — {title}', flush=True)
    if not a.dry_run:
        new = not os.path.exists(LOG)
        with open(LOG, 'a', encoding='utf-8', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()) if rows else ['file'])
            if new: w.writeheader()
            w.writerows(rows)
    print('итог:', stat)


if __name__ == '__main__':
    main()
