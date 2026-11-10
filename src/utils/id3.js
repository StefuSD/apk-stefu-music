import * as FileSystem from 'expo-file-system/legacy';
import { b64ToBytes, bytesToB64 } from './base64';

// Теги MP3: ID3v2 (2.2 / 2.3 / 2.4) в начале файла и ID3v1 в конце.
// Читаем только нужные байты, а не весь файл. Обложку (APIC) отдаём байтами —
// её сохраняет вызывающий.

const MAX_TAG = 3 * 1024 * 1024;   // больше обложки почти не бывают

async function readBytes(uri, position, length) {
  const s = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64, position, length,
  });
  return b64ToBytes(s);
}

// cp1251: старые русские MP3 пишут кириллицу в «латинских» полях.
const CP1251_HI = 'ЂЃ‚ѓ„…†‡€‰Љ‹ЊЌЋЏђ‘’“”•–—\u0098™љ›њќћџ ЎўЈ¤Ґ¦§Ё©Є«¬­®Ї°±Ііґµ¶·ё№є»јЅѕї'
  + 'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюя';

function latin(b) {
  // Если «высоких» байтов много и они в кириллическом диапазоне — это cp1251.
  let hi = 0, cyr = 0;
  for (const x of b) { if (x >= 0x80) { hi++; if (x >= 0xc0) cyr++; } }
  const asCp = hi > 0 && cyr / hi > 0.6;
  let s = '';
  for (const x of b) s += x < 0x80 ? String.fromCharCode(x) : asCp ? CP1251_HI[x - 0x80] : String.fromCharCode(x);
  return s;
}

function utf8(b) {
  let s = '', i = 0;
  while (i < b.length) {
    const c = b[i++];
    if (c < 0x80) s += String.fromCharCode(c);
    else if (c < 0xe0) s += String.fromCharCode(((c & 31) << 6) | (b[i++] & 63));
    else if (c < 0xf0) s += String.fromCharCode(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else {
      const cp = ((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63);
      s += String.fromCodePoint(cp);
    }
  }
  return s;
}

function utf16(b, be) {
  let i = 0;
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) { be = false; i = 2; }
  else if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) { be = true; i = 2; }
  let s = '';
  for (; i + 1 < b.length; i += 2) s += String.fromCharCode(be ? (b[i] << 8) | b[i + 1] : b[i] | (b[i + 1] << 8));
  return s;
}

function decode(enc, b) {
  const s = enc === 1 ? utf16(b, false) : enc === 2 ? utf16(b, true) : enc === 3 ? utf8(b) : latin(b);
  return s.replace(/\u0000+$/g, '').split('\u0000')[0].trim();
}

// Конец строки с нулём: 1 байт для latin/utf8, 2 для utf16.
function termEnd(b, from, enc) {
  if (enc === 1 || enc === 2) {
    for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i;
    return b.length;
  }
  for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
  return b.length;
}

const synch = (b, o) => (b[o] << 21) | (b[o + 1] << 14) | (b[o + 2] << 7) | b[o + 3];
const be32 = (b, o) => ((b[o] << 24) >>> 0) + (b[o + 1] << 16) + (b[o + 2] << 8) + b[o + 3];

const NAMES = {
  TIT2: 'title', TT2: 'title', TPE1: 'artist', TP1: 'artist', TALB: 'album', TAL: 'album',
  TCON: 'genre', TCO: 'genre', TYER: 'year', TYE: 'year', TDRC: 'year',
};

// «(17)Rock» и «17» в TCON — номер жанра ID3v1; цифры без названия просто убираем.
function cleanGenre(g) {
  return g.replace(/^\(\d+\)/, '').replace(/^\d+$/, '').trim();
}

async function readV2(uri) {
  const head = await readBytes(uri, 0, 10);
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return null;
  const ver = head[3];
  const size = synch(head, 6);
  const b = await readBytes(uri, 10, Math.min(size, MAX_TAG));
  const out = {};
  let o = 0;
  if (head[5] & 0x40 && ver >= 3) o += ver === 4 ? synch(b, 0) : be32(b, 0) + 4;   // extended header
  const idLen = ver === 2 ? 3 : 4;
  const hdLen = ver === 2 ? 6 : 10;
  while (o + hdLen <= b.length) {
    const id = String.fromCharCode(...b.slice(o, o + idLen));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const len = ver === 2 ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5]
      : ver === 4 ? synch(b, o + 4) : be32(b, o + 4);
    const start = o + hdLen;
    const data = b.subarray(start, Math.min(start + len, b.length));
    o = start + len;
    if (!len) continue;
    if (NAMES[id] && !out[NAMES[id]]) {
      const v = decode(data[0], data.subarray(1));
      if (v) out[NAMES[id]] = v;
    } else if (id === 'TXXX' && !out.extra) {
      // Данные Stefu Music из «Поделиться» (src/utils/shareSong.js): JSON в TXXX «STEFU_MUSIC».
      const enc = data[0];
      const e = termEnd(data, 1, enc);
      const desc = decode(enc, data.subarray(1, e));
      if (desc === 'STEFU_MUSIC') {
        const raw = data.subarray(e + (enc === 1 || enc === 2 ? 2 : 1));
        const val = (enc === 1 ? utf16(raw, false) : enc === 2 ? utf16(raw, true) : enc === 3 ? utf8(raw) : latin(raw)).replace(/\u0000+$/g, '');
        try { out.extra = JSON.parse(val); } catch (err) { /* чужой или битый JSON */ }
      }
    } else if ((id === 'USLT' || id === 'ULT') && !out.lyrics) {
      // слова песни: кодировка, язык (3 байта), описание с нулём, текст
      const enc = data[0];
      const p = termEnd(data, 4, enc) + (enc === 1 || enc === 2 ? 2 : 1);
      const raw = data.subarray(p);
      const txt = (enc === 1 ? utf16(raw, false) : enc === 2 ? utf16(raw, true) : enc === 3 ? utf8(raw) : latin(raw))
        .replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
      if (txt) out.lyrics = txt;
    } else if ((id === 'APIC' || id === 'PIC') && !out.cover) {
      const enc = data[0];
      let p = 1, mime;
      if (id === 'PIC') { mime = 'image/' + String.fromCharCode(...data.subarray(1, 4)).toLowerCase(); p = 4; }
      else { const e = termEnd(data, 1, 0); mime = latin(data.subarray(1, e)); p = e + 1; }
      p += 1;                                          // тип картинки
      p = termEnd(data, p, enc) + (enc === 1 || enc === 2 ? 2 : 1);  // описание
      if (p < data.length) out.cover = { mime, b64: bytesToB64(data.subarray(p)) };
    }
  }
  if (out.genre) out.genre = cleanGenre(out.genre);
  if (out.year) out.year = out.year.slice(0, 4);
  return out;
}

async function readV1(uri, size) {
  if (!size || size < 128) return null;
  const b = await readBytes(uri, size - 128, 128);
  if (b[0] !== 0x54 || b[1] !== 0x41 || b[2] !== 0x47) return null;
  const f = (a, z) => latin(b.subarray(a, z)).split('\u0000')[0].trim();
  return { title: f(3, 33), artist: f(33, 63), album: f(63, 93), year: f(93, 97) };
}

/** «Исполнитель - Название.mp3» → поля; иначе всё имя — название. */
export function fromFileName(name) {
  const base = (name || '').replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/^\d{1,3}[.\s-]+/, '').trim();
  const m = base.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: base };
}

/** Поля песни из тегов файла. Ошибки чтения не роняют импорт. */
export async function readTags(uri, size, fileName) {
  let tags = {};
  try { tags = (await readV2(uri)) || {}; } catch (e) { tags = {}; }
  if (!tags.title || !tags.artist) {
    try {
      const v1 = await readV1(uri, size);
      if (v1) for (const k of Object.keys(v1)) if (!tags[k] && v1[k]) tags[k] = v1[k];
    } catch (e) { /* без ID3v1 */ }
  }
  const byName = fromFileName(fileName);
  if (!tags.title) { tags.title = byName.title; if (!tags.artist && byName.artist) tags.artist = byName.artist; }
  return tags;
}

// ── Длительность MP3 по заголовку кадра ─────────────────────────────────
// VBR: число кадров из заголовка Xing/Info или VBRI. CBR: размер / битрейт.
const BITRATES = {
  3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],   // MPEG-1 Layer III
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],      // MPEG-2 / 2.5 Layer III
};
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export async function mp3Duration(uri, size) {
  try {
    const head = await readBytes(uri, 0, 10);
    let start = 0;
    if (head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) start = 10 + synch(head, 6) + (head[5] & 0x10 ? 10 : 0);
    const b = await readBytes(uri, start, 64 * 1024);
    for (let i = 0; i + 4 < b.length; i++) {
      if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) continue;
      const ver = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3;
      const br = b[i + 2] >> 4, sr = (b[i + 2] >> 2) & 3, chan = b[i + 3] >> 6;
      if (ver === 1 || layer !== 1 || br === 0 || br === 15 || sr === 3) continue;
      const rate = RATES[ver][sr];
      const spf = ver === 3 ? 1152 : 576;
      const side = ver === 3 ? (chan === 3 ? 17 : 32) : (chan === 3 ? 9 : 17);
      const x = i + 4 + side;
      const tag = String.fromCharCode(b[x], b[x + 1], b[x + 2], b[x + 3]);
      if ((tag === 'Xing' || tag === 'Info') && (be32(b, x + 4) & 1)) return be32(b, x + 8) * spf / rate;
      const v = i + 36;
      if (String.fromCharCode(b[v], b[v + 1], b[v + 2], b[v + 3]) === 'VBRI') return be32(b, v + 14) * spf / rate;
      const kbps = BITRATES[ver === 3 ? 3 : 2][br];
      return Math.max(0, (size - start - i) * 8 / (kbps * 1000));
    }
  } catch (e) { /* не MP3 или не прочитался */ }
  return 0;
}
