import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { artistsOf, joinArtists } from './artists';

/**
 * «Поделиться песней»: копия файла с нашими данными в тегах ID3v2.3.
 *
 * Пишем стандартные поля, которые понимает любой плеер: название (TIT2),
 * исполнители (TPE1, через « · »), альбом, жанр, год, слова (USLT), языки
 * (TLAN) и обложку (APIC). Всё остальное, что есть только в Stefu Music
 * (теги, языки кодами, ссылка на видео, обрезка), — в TXXX «STEFU_MUSIC»
 * как JSON: при загрузке такого файла в Stefu Music всё восстановится.
 *
 * Старый тег ID3v2 в начале файла отрезаем, аудио копируем как есть.
 * Не-MP3 (M4A, FLAC…) отправляем без изменений — у них другие теги.
 */

const enc16 = (str) => {
  // UTF-16LE с BOM — кодировка 1 в ID3v2.3, её читают все плееры.
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = 0xff; out[1] = 0xfe;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); out[2 + i * 2] = c & 255; out[3 + i * 2] = c >> 8; }
  return out;
};
const latin = (str) => Uint8Array.from(str, ch => ch.charCodeAt(0) & 255);
const cat = (parts) => {
  const n = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const be32 = (n) => Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255);
const synch = (n) => Uint8Array.of((n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127);

function frame(id, body) {
  return cat([latin(id), be32(body.length), Uint8Array.of(0, 0), body]);
}
const text = (id, value) => frame(id, cat([Uint8Array.of(1), enc16(value)]));
const txxx = (desc, value) => frame('TXXX', cat([Uint8Array.of(1), enc16(desc), Uint8Array.of(0, 0), enc16(value)]));
const uslt = (lyrics) => frame('USLT', cat([Uint8Array.of(1), latin('xxx'), enc16(''), Uint8Array.of(0, 0), enc16(lyrics)]));
const apic = (mime, bytes) => frame('APIC', cat([Uint8Array.of(0), latin(mime), Uint8Array.of(0), Uint8Array.of(3), Uint8Array.of(0), bytes]));

/** Где кончается старый тег ID3v2 (0 — тега нет). */
function oldTagEnd(b) {
  if (b.length < 10 || b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33) return 0;
  const size = (b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9];
  return 10 + size + (b[5] & 0x10 ? 10 : 0);
}

/** MP3 целиком: новый тег ID3v2.3 с нашими полями + аудио без старого тега. */
async function taggedBytes(song, all, coverUri) {
  const artists = artistsOf(song);
  const frames = [text('TIT2', song.title)];
  if (artists.length) frames.push(text('TPE1', joinArtists(artists)));
  if (song.album) frames.push(text('TALB', song.album));
  if (song.genre) frames.push(text('TCON', song.genre));
  if (song.year) frames.push(text('TYER', String(song.year)));
  if (song.langs?.length) frames.push(text('TLAN', song.langs.join('/')));
  if (song.lyrics) frames.push(uslt(song.lyrics));
  const extra = {
    artists, tags: song.tags || [], langs: song.langs || [], videoUrl: song.videoUrl || '',
    trimStart: song.trimStart || 0, trimEnd: song.trimEnd || 0, fadeIn: song.fadeIn || 0, fadeOut: song.fadeOut || 0,
    note: song.note || '', artTheme: song.artTheme || null, artVariant: song.artVariant || 0,
  };
  frames.push(txxx('STEFU_MUSIC', JSON.stringify(extra)));
  if (coverUri) {
    try {
      const cb = await new File(coverUri).bytes();
      const png = cb[0] === 0x89 && cb[1] === 0x50;
      frames.push(apic(png ? 'image/png' : 'image/jpeg', cb));
    } catch (e) { /* без обложки */ }
  }
  const body = cat(frames);
  const pad = new Uint8Array(512);                       // запас, как делают редакторы тегов
  const header = cat([latin('ID3'), Uint8Array.of(3, 0, 0), synch(body.length + pad.length)]);
  return cat([header, body, pad, all.subarray(oldTagEnd(all))]);
}

/**
 * Вшить поля песни (обложку, название, исполнителей, слова…) в сам файл MP3
 * в библиотеке. Пишем во временный файл рядом и подменяем им старый: плеер,
 * который сейчас читает песню, держит открытым прежний файл и не сбивается.
 * Не-MP3 не трогаем. Возвращает true, если файл переписан.
 */
export async function embedTags(song, { songUri, coverUri }) {
  if (!/\.mp3$/i.test(songUri)) return false;
  const src = new File(songUri);
  if (!src.exists) return false;
  const tmp = new File(songUri + '.tmp');
  if (tmp.exists) tmp.delete();
  tmp.create();
  tmp.write(await taggedBytes(song, await src.bytes(), coverUri));
  src.delete();
  tmp.move(new File(songUri));
  return true;
}

const safeName = (s) => (s || 'song').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

/**
 * @param song   запись песни
 * @param files  { songUri, coverUri } — пути к файлу песни и обложке
 */
export async function shareSong(song, { songUri, coverUri }) {
  const ext = (song.file.match(/\.[a-z0-9]+$/i) || ['.mp3'])[0].toLowerCase();
  const artists = artistsOf(song);
  const name = safeName((artists.length ? joinArtists(artists) + ' - ' : '') + song.title) + ext;
  const out = new File(Paths.cache, name);
  if (out.exists) out.delete();

  const src = new File(songUri);
  if (ext !== '.mp3') {
    src.copy(out);
  } else {
    out.create();
    out.write(await taggedBytes(song, await src.bytes(), coverUri));
  }
  await Sharing.shareAsync(out.uri, {
    mimeType: ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'audio/*',
    dialogTitle: song.title,
  });
}
