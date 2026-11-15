#!/usr/bin/env python3
"""Audio features for "similar songs" in Stefu Music.

Usage:
  python sound.py [--out PATH] [--covers-log PATH] [--cache PATH] [--force]
                  [--no-embed] [--limit N] [--push] FOLDER [FOLDER ...]

Per MP3 (recursive, one file at a time): decode to mono 22050 Hz with
miniaudio, analyse the middle 90 s and compute
  bpm          onset envelope = spectral flux of the log-magnitude STFT
               (n_fft 1024, hop 256 -> ~86 frames/s), minus a 1 s moving
               average, half-wave rectified. Its autocorrelation is scored on a
               70..180 BPM grid (0.25 step) with a harmonic comb
               acf(L) + acf(2L)/2 + acf(3L)/3 + acf(4L)/4, weighted by a
               log-normal tempo prior around 110 BPM (sigma 1 octave). Octave
               correction: the winner is compared with its x2 / x0.5 tempo
               (if inside 70..180) and the better prior-weighted score wins.
  rms_db       20*log10 of the mean frame RMS (2048/512), dBFS.
  centroid_hz  mean spectral centroid over non-silent frames.
  onset_rate   onset peaks per second (internal, feeds energy).
Over the whole set (percentile rank 0..1, 2 decimals):
  energy = rank(0.6*rank(rms_db) + 0.4*rank(onset_rate))
  bright = rank(centroid_hz)

Writes JSON (UTF-8, no BOM) to --out (default D:\\music\\stefu-music-sound.json)
and merges {"sound":{"bpm","energy","bright"}} into the TXXX:STEFU_MUSIC frame
(JSON object, other keys kept), ID3v2.3. size0 (original size) comes from the
covers log. Raw features are cached (--cache) so reruns are quick.
"""
import argparse
import csv
import json
import os
import subprocess
import sys

import numpy as np
import miniaudio
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks
from mutagen.id3 import ID3, TXXX, ID3NoHeaderError

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from covers import artist_title, list_mp3  # noqa: E402

SR = 22050
WINDOW_S = 90
N_FFT = 1024
HOP = 256
FPS = SR / HOP
BPM_MIN, BPM_MAX = 70.0, 180.0
DEFAULT_OUT = r"D:\music\stefu-music-sound.json"
DEFAULT_LOG = r"D:\music\covers-log.csv"
DEFAULT_CACHE = r"D:\tmp\stefu-music\sound-cache.json"
FRAME_DESC = "STEFU_MUSIC"


def decode_middle(path):
    with open(path, "rb") as fh:
        data = fh.read()
    d = miniaudio.decode(data, output_format=miniaudio.SampleFormat.FLOAT32,
                         nchannels=1, sample_rate=SR)
    del data
    x = np.frombuffer(d.samples, dtype=np.float32)
    n = WINDOW_S * SR
    if len(x) > n:
        s = (len(x) - n) // 2
        x = x[s:s + n]
    return np.array(x, dtype=np.float32)


def frames(x, size, hop):
    if len(x) < size:
        x = np.pad(x, (0, size - len(x)))
    n = 1 + (len(x) - size) // hop
    return np.lib.stride_tricks.as_strided(
        x, shape=(n, size), strides=(x.strides[0] * hop, x.strides[0]), writeable=False)


def interp(a, pos):
    i = np.floor(pos).astype(int)
    f = pos - i
    ok = i + 1 < len(a)
    out = np.zeros_like(pos)
    out[ok] = a[i[ok]] * (1 - f[ok]) + a[i[ok] + 1] * f[ok]
    return out


def analyse(path):
    x = decode_middle(path)
    # loudness
    rf = frames(x, 2048, 512)
    rms = np.sqrt(np.mean(rf.astype(np.float64) ** 2, axis=1))
    rms_db = 20 * np.log10(max(rms.mean(), 1e-9))
    # spectrum
    win = np.hanning(N_FFT).astype(np.float32)
    mag = np.abs(np.fft.rfft(frames(x, N_FFT, HOP) * win, axis=1)).astype(np.float32)
    freqs = np.fft.rfftfreq(N_FFT, 1 / SR).astype(np.float32)
    msum = mag.sum(axis=1)
    frame_rms = np.sqrt(np.mean(frames(x, N_FFT, HOP) ** 2, axis=1))
    loud = frame_rms > 10 ** (-50 / 20)
    cent = (mag @ freqs) / np.maximum(msum, 1e-9)
    centroid = float(cent[loud].mean()) if loud.any() else 0.0
    # onset envelope (spectral flux of log magnitude)
    lm = np.log1p(100 * mag)
    del mag
    flux = np.maximum(lm[1:] - lm[:-1], 0).sum(axis=1)
    del lm
    o = flux - uniform_filter1d(flux, size=int(FPS))
    o = np.maximum(o, 0)
    # onset density
    thr = np.median(o) + 0.5 * o.std()
    peaks, _ = find_peaks(o, height=thr, distance=max(1, int(0.1 * FPS)))
    onset_rate = len(peaks) / (len(x) / SR)
    # tempo
    oc = o - o.mean()
    n = len(oc)
    spec = np.fft.rfft(oc, 2 * n)
    acf = np.fft.irfft(spec * np.conj(spec))[:n]
    acf = acf / max(acf[0], 1e-9)
    grid = np.arange(BPM_MIN, BPM_MAX + 0.01, 0.25)

    def score(bpms):
        lag = 60 * FPS / bpms
        s = sum(interp(acf, k * lag) / k for k in (1, 2, 3, 4))
        prior = np.exp(-0.5 * (np.log2(bpms / 110.0) / 1.0) ** 2)
        return s * prior, s

    sc, _ = score(grid)
    best = float(grid[int(np.argmax(sc))])
    cands = [b for b in (best, best * 2, best / 2) if BPM_MIN <= b <= BPM_MAX]
    cs, _ = score(np.array(cands))
    bpm = cands[int(np.argmax(cs))]
    return {"bpm": int(round(bpm)), "rms_db": round(float(rms_db), 1),
            "centroid_hz": int(round(centroid)), "onset_rate": round(float(onset_rate), 3)}


def prank(values):
    v = np.asarray(values, dtype=float)
    if len(v) < 2:
        return np.zeros(len(v))
    order = v.argsort(kind="mergesort")
    ranks = np.empty(len(v))
    ranks[order] = np.arange(len(v))
    # average ranks for ties
    for val in np.unique(v):
        m = v == val
        if m.sum() > 1:
            ranks[m] = ranks[m].mean()
    return ranks / (len(v) - 1)


def load_json(path, default):
    try:
        with open(path, encoding="utf-8-sig") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def write_json(path, obj, **kw):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:  # no BOM
        json.dump(obj, fh, ensure_ascii=False, **kw)
    os.replace(tmp, path)


def embed(path, sound):
    """Merge {"sound": ...} into TXXX:STEFU_MUSIC. Returns 'written'/'same'/error text."""
    try:
        tags = ID3(path)
    except ID3NoHeaderError:
        tags = ID3()
    obj = {}
    frames_ = tags.getall("TXXX:" + FRAME_DESC)
    if frames_:
        raw = frames_[0].text[0] if frames_[0].text else ""
        if raw.strip():
            try:
                obj = json.loads(raw)
            except ValueError:
                return "existing STEFU_MUSIC is not JSON, left untouched"
            if not isinstance(obj, dict):
                return "existing STEFU_MUSIC is not an object, left untouched"
    if obj.get("sound") == sound:
        return "same"
    obj["sound"] = sound
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    tags.delall("TXXX:" + FRAME_DESC)
    tags.add(TXXX(encoding=1, desc=FRAME_DESC, text=[text]))
    tags.save(path, v2_version=3)
    return "written"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folders", nargs="+")
    ap.add_argument("--out", default=DEFAULT_OUT)
    ap.add_argument("--covers-log", default=DEFAULT_LOG)
    ap.add_argument("--cache", default=DEFAULT_CACHE)
    ap.add_argument("--force", action="store_true", help="re-analyse even if cached")
    ap.add_argument("--no-embed", action="store_true", help="do not write TXXX:STEFU_MUSIC")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--push", action="store_true",
                    help="adb push the JSON to /sdcard/Music/stefu-music-sound.json")
    args = ap.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    os.makedirs(os.path.dirname(args.cache), exist_ok=True)
    cache = load_json(args.cache, {})
    size0 = {}
    if os.path.exists(args.covers_log):
        with open(args.covers_log, encoding="utf-8-sig", newline="") as fh:
            for r in csv.DictReader(fh):
                if r.get("size0"):
                    size0[r["file"]] = int(r["size0"])

    files = list(list_mp3(args.folders))
    if args.limit:
        files = files[:args.limit]
    feats, failed = {}, []
    for i, f in enumerate(files, 1):
        if f in cache and not args.force:
            feats[f] = cache[f]
            continue
        try:
            feats[f] = cache[f] = analyse(f)
            print(f"[{i}/{len(files)}] {feats[f]['bpm']:>3} bpm  {os.path.basename(f)}", flush=True)
        except Exception as e:
            failed.append(f)
            print(f"[{i}/{len(files)}] FAILED {os.path.basename(f)}: {e}", flush=True)
        if i % 25 == 0:
            write_json(args.cache, cache)
    write_json(args.cache, cache)

    keys = list(feats)
    r_rms = prank([feats[k]["rms_db"] for k in keys])
    r_on = prank([feats[k]["onset_rate"] for k in keys])
    energy = prank(0.6 * r_rms + 0.4 * r_on)
    bright = prank([feats[k]["centroid_hz"] for k in keys])

    songs, written = [], 0
    for j, f in enumerate(keys):
        ft = feats[f]
        sound = {"bpm": ft["bpm"], "energy": round(float(energy[j]), 2),
                 "bright": round(float(bright[j]), 2)}
        if not args.no_embed:
            res = embed(f, sound)
            if res == "written":
                written += 1
            elif res != "same":
                print("TXXX:", os.path.basename(f), res)
        try:
            tags = ID3(f)
        except ID3NoHeaderError:
            tags = None
        artist, title = artist_title(f, tags)
        song = {"name": os.path.basename(f), "size": os.path.getsize(f)}
        if f in size0 and size0[f] != song["size"]:
            song["size0"] = size0[f]
        song.update(title=title, artist=artist, bpm=ft["bpm"], energy=sound["energy"],
                    bright=sound["bright"], rms_db=ft["rms_db"], centroid_hz=ft["centroid_hz"])
        songs.append(song)

    write_json(args.out, {"app": "Stefu Music sound", "version": 1, "songs": songs})
    bpms = np.array([s["bpm"] for s in songs])
    print(f"songs: {len(songs)}, failed: {len(failed)}, TXXX written: {written}, json: {args.out}")
    if len(bpms):
        hist, edges = np.histogram(bpms, bins=np.arange(70, 190, 10))
        for h, e in zip(hist, edges):
            print(f"  {int(e)}-{int(e) + 9}: {h}")
    for f in failed:
        print("failed:", f)
    if args.push:
        subprocess.run(["adb", "push", args.out, "/sdcard/Music/stefu-music-sound.json"], check=False)


if __name__ == "__main__":
    main()
