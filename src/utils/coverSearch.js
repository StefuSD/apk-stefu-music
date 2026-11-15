import * as FileSystem from 'expo-file-system/legacy';
import { b64ToBytes } from './base64';

/**
 * Поиск обложки в интернете по исполнителю и названию: сначала iTunes
 * Search API, потом Deezer. Оба бесплатные и без ключа. Отправляется только
 * строка поиска «исполнитель название» — больше ничего о пользователе.
 */

const norm = s => (s || '').toLowerCase()
  .replace(/\(.*?\)|\[.*?\]/g, ' ')
  .replace(/\b(feat|ft|featuring)\b.*$/g, ' ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

/** Похожесть строк 0..1 (по общим словам; вхождение одной в другую — 1). */
function close(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b || a.includes(b) || b.includes(a)) return 1;
  const A = new Set(a.split(' ')), B = new Set(b.split(' '));
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.max(A.size, B.size);
}

async function getJson(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function itunes(term) {
  const j = await getJson('https://itunes.apple.com/search?entity=song&limit=12&term=' + encodeURIComponent(term));
  return (j.results || []).filter(x => x.artworkUrl100).map(x => ({
    thumb: x.artworkUrl100,
    url: x.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
    artist: x.artistName, title: x.trackName, album: x.collectionName, source: 'iTunes',
  }));
}

async function deezer(term) {
  const j = await getJson('https://api.deezer.com/search?limit=12&q=' + encodeURIComponent(term));
  return (j.data || []).filter(x => x.album && x.album.cover_medium).map(x => ({
    thumb: x.album.cover_medium,
    url: x.album.cover_xl || x.album.cover_big || x.album.cover_medium,
    artist: x.artist && x.artist.name, title: x.title, album: x.album.title, source: 'Deezer',
  }));
}

/** Варианты обложек, лучшие (совпали исполнитель и название) первыми, без повторов картинки. */
export async function searchCovers(artist, title) {
  const term = [artist, title].filter(Boolean).join(' ').trim();
  if (!term) return [];
  let out = [];
  try { out = await itunes(term); } catch (e) { /* попробуем Deezer */ }
  if (out.length < 4) { try { out = out.concat(await deezer(term)); } catch (e) { /* без Deezer */ } }
  const seen = new Set();
  return out
    .map(x => ({ ...x, score: close(x.artist, artist) * 2 + close(x.title, title) }))
    .sort((a, b) => b.score - a.score)
    .filter(x => (seen.has(x.thumb) ? false : (seen.add(x.thumb), true)));
}

/** Лучший вариант, только если совпали и исполнитель, и название (для «найти для всех»). */
export async function bestCover(artist, title) {
  if (!artist || !title) return null;
  const list = await searchCovers(artist, title);
  const b = list[0];
  return b && close(b.artist, artist) >= 0.8 && close(b.title, title) >= 0.8 ? b : null;
}

/** Скачать картинку во временную папку; null — не картинка или не скачалась. */
export async function downloadImage(url) {
  const dest = FileSystem.cacheDirectory + 'cover-dl-' + Date.now() + Math.random().toString(36).slice(2, 6);
  const r = await FileSystem.downloadAsync(url, dest);
  if (r.status < 200 || r.status >= 300) { FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {}); return null; }
  const b = b64ToBytes(await FileSystem.readAsStringAsync(r.uri, { encoding: FileSystem.EncodingType.Base64, position: 0, length: 4 }));
  const jpg = b[0] === 0xff && b[1] === 0xd8;
  const png = b[0] === 0x89 && b[1] === 0x50;
  if (!jpg && !png) { FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => {}); return null; }
  return { uri: r.uri, ext: png ? '.png' : '.jpg' };
}
