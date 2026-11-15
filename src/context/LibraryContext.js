import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { maybeAutoBackup } from '../utils/backup';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { readTags, mp3Duration, splitArtistTitle } from '../utils/id3';
import { createAudioPlayer } from 'expo-audio';
import { buildIndex } from '../utils/recommend';
import { splitArtists, joinArtists, artistsOf } from '../utils/artists';
import { bestCover, downloadImage } from '../utils/coverSearch';
import StefuAudio from '../../modules/stefu-audio';

/**
 * Библиотека и история прослушиваний.
 *
 * Файлы песен копируются в папку приложения (documentDirectory/music) —
 * так они не пропадут, если оригинал в «Загрузках» удалят. Обложки из тегов
 * лежат рядом в covers/.
 *
 * Песня: { id, file, cover, title, artist, album, genre, year, tags[], fav,
 *          note, duration, size, origName, addedAt }
 * Прослушивание (сеанс): { id, s: songId, t: начало (ms), d: секунд, c: засчитано 0/1 }
 * Один сеанс — одно включение песни; пауза и перемотка его не делят.
 */

const K_SONGS = 'sm_songs';
const K_PLAYS = 'sm_plays';
const K_LISTS = 'sm_playlists';   // [{ id, name, ids[], createdAt }]
const K_TAGW = 'sm_tagw';         // { тег: множитель } — ручные веса тегов для «Похожих»
export const MUSIC_DIR = FileSystem.documentDirectory + 'music/';
export const COVERS_DIR = FileSystem.documentDirectory + 'covers/';
// Библиотека — отдельным файлом: в AsyncStorage на Android предел ~2 МБ на запись,
// а со словами песен список давно больше. Старые данные из sm_songs переносятся сюда.
const LIB_FILE = FileSystem.documentDirectory + 'library.json';
const LIB_TMP = FileSystem.documentDirectory + 'library.tmp.json';

async function loadSongsRaw() {
  try {
    const i = await FileSystem.getInfoAsync(LIB_FILE);
    if (i.exists) return await FileSystem.readAsStringAsync(LIB_FILE);
  } catch (e) { /* читаем старое место */ }
  return AsyncStorage.getItem(K_SONGS);
}

/** Запись через временный файл и подмену — оборванная запись не портит библиотеку. */
// Записи идут строго по очереди: две одновременные писали бы в один временный файл.
let writeChain = Promise.resolve();
function writeSongsFile(json) {
  writeChain = writeChain.catch(() => {}).then(async () => {
    await FileSystem.writeAsStringAsync(LIB_TMP, json);
    try { await FileSystem.moveAsync({ from: LIB_TMP, to: LIB_FILE }); }
    catch (e) { await FileSystem.writeAsStringAsync(LIB_FILE, json); }
  });
  return writeChain;
}

// История прослушиваний — тоже файлом (раньше sm_plays в AsyncStorage). Запись больше ~2 МБ
// AsyncStorage на Android не может прочитать (CursorWindow): чтение падало, приложение начинало
// с пустой историей и при уходе в фон записывало её поверх — накопленная статистика пропадала.
const PLAYS_FILE = FileSystem.documentDirectory + 'plays.json';
const PLAYS_TMP = FileSystem.documentDirectory + 'plays.tmp.json';
const PLAYS_BAK = FileSystem.documentDirectory + 'plays-backup.json';   // копия раз в сутки
const DAY = 24 * 3600 * 1000;

async function loadPlaysRaw() {
  const i = await FileSystem.getInfoAsync(PLAYS_FILE);
  if (i.exists) return { raw: await FileSystem.readAsStringAsync(PLAYS_FILE), inFile: true };
  return { raw: await AsyncStorage.getItem(K_PLAYS), inFile: false };
}

let playsChain = Promise.resolve();
function writePlaysFile(json) {
  playsChain = playsChain.catch(() => {}).then(async () => {
    // резервная копия: не чаще раза в сутки, из прошлого удачного файла
    try {
      const [cur, bak] = await Promise.all([FileSystem.getInfoAsync(PLAYS_FILE), FileSystem.getInfoAsync(PLAYS_BAK)]);
      if (cur.exists && cur.size > 2 && (!bak.exists || !bak.modificationTime || Date.now() - bak.modificationTime * 1000 > DAY)) {
        await FileSystem.deleteAsync(PLAYS_BAK, { idempotent: true });
        await FileSystem.copyAsync({ from: PLAYS_FILE, to: PLAYS_BAK });
      }
    } catch (e) { /* без копии */ }
    await FileSystem.writeAsStringAsync(PLAYS_TMP, json);
    try { await FileSystem.moveAsync({ from: PLAYS_TMP, to: PLAYS_FILE }); }
    catch (e) { await FileSystem.writeAsStringAsync(PLAYS_FILE, json); }
  });
  return playsChain;
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const MIME_EXT = {
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac',
  'audio/flac': '.flac', 'audio/x-flac': '.flac', 'audio/ogg': '.ogg', 'audio/opus': '.opus',
  'audio/wav': '.wav', 'audio/x-wav': '.wav',
};

async function ensureDirs() {
  for (const d of [MUSIC_DIR, COVERS_DIR]) {
    const i = await FileSystem.getInfoAsync(d);
    if (!i.exists) await FileSystem.makeDirectoryAsync(d, { intermediates: true });
  }
}

/**
 * Длительность любого файла: MP3 считаем по заголовку (быстро, без
 * воспроизведения), остальное — открываем в невидимом плеере и ждём,
 * пока он узнает длину (не дольше 5 секунд).
 */
async function measure(uri, size) {
  if (/\.mp3$/i.test(uri)) {
    const d = await mp3Duration(uri, size);
    if (d > 0) return d;
  }
  return new Promise((resolve) => {
    let p, sub, done = false;
    const finish = (d) => {
      if (done) return;
      done = true;
      try { sub && sub.remove(); p && p.remove(); } catch (e) { /* уже освобождён */ }
      resolve(d || 0);
    };
    try {
      p = createAudioPlayer({ uri });
      sub = p.addListener('playbackStatusUpdate', (st) => { if (st.isLoaded && st.duration > 0) finish(st.duration); });
    } catch (e) { finish(0); return; }
    setTimeout(() => finish(p && p.duration), 5000);
  });
}

/** Звучание песни из файла или JSON с компьютера (tools/sound.py): темп, энергия и яркость 0..1. */
function cleanSound(x) {
  if (!x || typeof x !== 'object') return null;
  const bpm = Number(x.bpm), energy = Number(x.energy), bright = Number(x.bright);
  const o = {};
  if (bpm > 30 && bpm < 300) o.bpm = Math.round(bpm);
  if (x.energy != null && energy >= 0 && energy <= 1) o.energy = energy;
  if (x.bright != null && bright >= 0 && bright <= 1) o.bright = bright;
  return Object.keys(o).length ? o : null;
}

const normKey = s => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Ключ песни для поиска повторов: исполнители и название без «feat.», скобок, регистра и знаков. */
function songKey(artists, title) {
  const clean = s => normKey((s || '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s(feat|ft|featuring)\.?\s.*$/i, ' '));
  const a = (artists || []).map(clean).filter(Boolean).sort().join('|');
  const t = clean(title);
  return a && t ? a + '#' + t : '';
}

const Ctx = createContext(null);

export function LibraryProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [plays, setPlays] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(null);   // { n, m } во время импорта
  const [scan, setScan] = useState(null);           // { n, m } пока досчитываем длительность
  const [playlists, setPlaylists] = useState([]);
  const [tagWeights, setTagWeights] = useState({});
  const listsRef = useRef([]);
  const playsRef = useRef([]);
  // История прочитана: только тогда её можно записывать (иначе пустая затёрла бы сохранённую).
  const playsOk = useRef(false);
  const songsRef = useRef([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureDirs();
        // история — отдельно от песен: сбой одного не обнуляет другое
        let pp = [];
        try {
          const { raw, inFile } = await loadPlaysRaw();
          pp = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(pp)) throw new Error('plays');
          playsOk.current = true;
          // перенос из AsyncStorage в файл; старую запись убираем только после проверки
          if (!inFile && pp.length) {
            try {
              const json = JSON.stringify(pp);
              await writePlaysFile(json);
              const back = await FileSystem.readAsStringAsync(PLAYS_FILE);
              if (back.length === json.length) AsyncStorage.removeItem(K_PLAYS);
            } catch (e) { /* останется в AsyncStorage */ }
          }
        } catch (e) { pp = []; /* не прочиталась — не перезаписываем (playsOk = false) */ }
        playsRef.current = pp; setPlays(pp);
        const s = await loadSongsRaw();
        let ss = s ? JSON.parse(s) : [];
        // Старые записи: одна строка «A & B» → отдельные исполнители и показ через «·».
        let migrated = false;
        ss = ss.map(x => {
          if (x.artists) return x;
          migrated = true;
          const artists = splitArtists(x.artist);
          return { ...x, artists, artist: joinArtists(artists) };
        });
        // Починка: исполнителя нет, а название «Би-2 - Варвара» — делим по тире с пробелами.
        ss = ss.map(x => {
          if (artistsOf(x).length) return x;
          const sp = splitArtistTitle(x.title);
          if (!sp) return x;
          migrated = true;
          const artists = splitArtists(sp.artist);
          return { ...x, title: sp.title, artists, artist: joinArtists(artists) };
        });
        // Перенос в файл (или сохранение починки): после удачной записи старую копию убираем.
        const inFile = (await FileSystem.getInfoAsync(LIB_FILE)).exists;
        // Пустой список не переносим и старую копию не трогаем: вдруг её просто не удалось прочитать.
        if ((migrated || !inFile) && ss.length) {
          try {
            const json = JSON.stringify(ss);
            await writeSongsFile(json);
            const back = await FileSystem.readAsStringAsync(LIB_FILE);
            if (!inFile && back.length === json.length) AsyncStorage.removeItem(K_SONGS);
          } catch (e) { /* останется в AsyncStorage */ }
        }
        try {
          const [l, w] = await Promise.all([AsyncStorage.getItem(K_LISTS), AsyncStorage.getItem(K_TAGW)]);
          const ll = l ? JSON.parse(l) : [];
          listsRef.current = ll; setPlaylists(ll);
          if (w) setTagWeights(JSON.parse(w));
        } catch (e) { /* без плейлистов */ }
        songsRef.current = ss;
        setSongs(ss);
      } catch (e) { /* пустая библиотека */ }
      setLoaded(true);
    })();
  }, []);

  // Сохранение библиотеки откладываем на 2 с: при разборе и импорте правки идут
  // пачками, а JSON на тысячу песен со словами — мегабайты; писать каждый раз нельзя.
  const songsTimer = useRef(null);
  const flushSongs = useCallback(() => {
    if (songsTimer.current) { clearTimeout(songsTimer.current); songsTimer.current = null; }
    writeSongsFile(JSON.stringify(songsRef.current)).catch(() => {});
  }, []);
  const commitSongs = useCallback((next) => {
    songsRef.current = next;
    setSongs(next);
    if (!songsTimer.current) songsTimer.current = setTimeout(flushSongs, 2000);
  }, [flushSongs]);

  const flushPlays = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!playsOk.current) return;     // сохранённую историю не удалось прочитать — не затираем её
    writePlaysFile(JSON.stringify(playsRef.current)).catch(() => {});
  }, []);

  // История пишется часто (каждые несколько секунд игры) — на диск
  // откладываем, а при уходе из приложения сбрасываем сразу.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st !== 'active') { flushPlays(); if (songsTimer.current) flushSongs(); }
    });
    return () => sub.remove();
  }, [flushPlays, flushSongs]);

  /** Записать или обновить сеанс прослушивания. */
  const recordListen = useCallback((session) => {
    const arr = playsRef.current;
    const rec = { id: session.id, s: session.songId, t: session.start, d: Math.round(session.sec), c: session.counted ? 1 : 0 };
    const i = arr.length - 1 >= 0 && arr[arr.length - 1].id === rec.id ? arr.length - 1 : arr.findIndex(p => p.id === rec.id);
    const next = i >= 0 ? [...arr.slice(0, i), rec, ...arr.slice(i + 1)] : [...arr, rec];
    playsRef.current = next;
    setPlays(next);
    if (!saveTimer.current) saveTimer.current = setTimeout(flushPlays, 4000);
  }, [flushPlays]);

  /**
   * Перенести файлы в библиотеку. items: { uri, name, size?, mimeType?, move }
   * move — файл уже во временной папке (из выбора файлов), его можно
   * переместить; иначе копируем (папка на телефоне остаётся нетронутой).
   */
  const ingest = useCallback(async (list) => {
    await ensureDirs();
    let added = 0, dup = 0, updated = 0;
    const fresh = [];
    const isDup = (name, size) => fresh.concat(songsRef.current).some(s => s.origName === name && s.size === size);
    // Та же песня под другим именем, в другом качестве или с новой обложкой:
    // те же исполнители и название и длительность ±2 с.
    const sameSong = (key, dur) => (key ? fresh.concat(songsRef.current).find(s =>
      songKey(artistsOf(s), s.title) === key && (!dur || !s.duration || Math.abs(s.duration - dur) <= 2)) : null);
    for (let k = 0; k < list.length; k++) {
      setProgress({ n: k + 1, m: list.length });
      const a = list[k];
      try {
        // Размер до копирования (папка телефона его сама не сообщает) — чтобы не копировать явные повторы.
        if (!a.size && !a.move) {
          try { const i0 = await FileSystem.getInfoAsync(a.uri); if (i0 && i0.size) a.size = i0.size; } catch (e) { /* узнаем после копии */ }
        }
        if (a.size && isDup(a.name, a.size)) {
          dup++;
          if (a.move) FileSystem.deleteAsync(a.uri, { idempotent: true }).catch(() => {});
          continue;
        }
        const id = newId();
        const extM = (a.name || '').match(/\.[A-Za-z0-9]{2,5}$/);
        const ext = (extM ? extM[0] : MIME_EXT[a.mimeType] || '.mp3').toLowerCase();
        const file = id + ext;
        if (a.move) {
          try { await FileSystem.moveAsync({ from: a.uri, to: MUSIC_DIR + file }); }
          catch (e) { await FileSystem.copyAsync({ from: a.uri, to: MUSIC_DIR + file }); }
        } else await FileSystem.copyAsync({ from: a.uri, to: MUSIC_DIR + file });
        if (!a.size) {
          const info = await FileSystem.getInfoAsync(MUSIC_DIR + file);
          a.size = info.size || 0;
          if (a.size && isDup(a.name, a.size)) {
            dup++;
            FileSystem.deleteAsync(MUSIC_DIR + file, { idempotent: true }).catch(() => {});
            continue;
          }
        }
        const tags = await readTags(MUSIC_DIR + file, a.size, a.name);
        const duration = Math.round(await measure(MUSIC_DIR + file, a.size));
        // Повтор по исполнителю, названию и длительности: второй записи не заводим,
        // а дополняем старую тем, чего у неё не было (обложка, альбом, жанр, год, слова).
        const xa = tags.extra && Array.isArray(tags.extra.artists) && tags.extra.artists.length ? tags.extra.artists.map(String) : splitArtists(tags.artist);
        const twin = sameSong(songKey(xa, tags.title || a.name), duration);
        if (twin) {
          dup++;
          const patch = {};
          if (!twin.cover && tags.cover) {
            const cn = twin.id + '-' + Date.now().toString(36) + (/png/i.test(tags.cover.mime) ? '.png' : '.jpg');
            try {
              await FileSystem.writeAsStringAsync(COVERS_DIR + cn, tags.cover.b64, { encoding: FileSystem.EncodingType.Base64 });
              patch.cover = cn;
            } catch (e) { /* без обложки */ }
          }
          if (!twin.album && tags.album) patch.album = tags.album;
          if (!twin.genre && tags.genre) patch.genre = tags.genre;
          if (!twin.year && tags.year) patch.year = tags.year;
          if (!twin.lyrics && tags.lyrics) patch.lyrics = tags.lyrics;
          if (Object.keys(patch).length) {
            updated++;
            const inFresh = fresh.find(s => s.id === twin.id);
            if (inFresh) Object.assign(inFresh, patch);
            else commitSongs(songsRef.current.map(s => (s.id === twin.id ? { ...s, ...patch } : s)));
          }
          FileSystem.deleteAsync(MUSIC_DIR + file, { idempotent: true }).catch(() => {});
          if (a.move) FileSystem.deleteAsync(a.uri, { idempotent: true }).catch(() => {});
          continue;
        }
        let cover = null;
        if (tags.cover) {
          cover = id + (/png/i.test(tags.cover.mime) ? '.png' : '.jpg');
          try {
            await FileSystem.writeAsStringAsync(COVERS_DIR + cover, tags.cover.b64, { encoding: FileSystem.EncodingType.Base64 });
          } catch (e) { cover = null; }
        }
        const song = {
          id, file, cover,
          title: tags.title || a.name, artists: splitArtists(tags.artist), artist: joinArtists(splitArtists(tags.artist)), album: tags.album || '',
          genre: tags.genre || '', year: tags.year || '', tags: [], fav: false, note: '', lyrics: tags.lyrics || '',
          duration, size: a.size || 0, origName: a.name, addedAt: Date.now(),
        };
        // Файл из «Поделиться» Stefu Music: возвращаем исполнителей, теги,
        // языки, ссылку на видео, обрезку и заметку как были у отправителя.
        const x = tags.extra;
        if (x && typeof x === 'object') {
          if (Array.isArray(x.artists) && x.artists.length) { song.artists = x.artists.map(String); song.artist = joinArtists(song.artists); }
          if (Array.isArray(x.tags)) song.tags = x.tags.map(String);
          if (Array.isArray(x.langs)) song.langs = x.langs.map(String);
          for (const k of ['videoUrl', 'note']) if (typeof x[k] === 'string') song[k] = x[k];
          if (typeof x.artTheme === 'string') song.artTheme = x.artTheme;
          if (Number(x.artVariant) > 0) song.artVariant = Number(x.artVariant);
          for (const k of ['trimStart', 'trimEnd', 'fadeIn', 'fadeOut']) if (Number(x[k]) > 0) song[k] = Number(x[k]);
          const snd = cleanSound(x.sound);
          if (snd) song.sound = snd;
        }
        fresh.unshift(song);
        added++;
        // Сохраняем порциями: при сотне файлов список растёт на глазах,
        // а оборванный импорт не теряет уже скопированное.
        if (fresh.length >= 10) { commitSongs([...fresh, ...songsRef.current]); fresh.length = 0; }
      } catch (e) { /* файл пропускаем */ }
    }
    if (fresh.length) commitSongs([...fresh, ...songsRef.current]);
    setProgress(null);
    return { added, dup, updated };
  }, [commitSongs]);

  const importMusic = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return null;
    return ingest(res.assets.map(a => ({ uri: a.uri, name: a.name, size: a.size, mimeType: a.mimeType, move: true })));
  }, [ingest]);

  /** Все аудиофайлы из выбранной папки телефона (без подпапок). */
  const importFolder = useCallback(async () => {
    const SAF = FileSystem.StorageAccessFramework;
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return null;
    const uris = await SAF.readDirectoryAsync(perm.directoryUri);
    const items = [];
    for (const uri of uris) {
      const name = decodeURIComponent(uri).split('/').pop();
      if (/\.(mp3|m4a|aac|flac|ogg|opus|wav)$/i.test(name)) items.push({ uri, name, move: false });
    }
    items.sort((x, y) => x.name.localeCompare(y.name));
    if (!items.length) return { added: 0, dup: 0, none: true };
    return ingest(items);
  }, [ingest]);

  // Песни без длительности (добавлены до того, как её стали считать, или
  // не распознались) — досчитываем в фоне по одной, сохраняя порциями.
  const scanning = useRef(false);
  useEffect(() => {
    if (!loaded || progress || scanning.current) return;
    const todo = songsRef.current.filter(s => !s.duration && !s.noDuration);
    if (!todo.length) return;
    scanning.current = true;
    (async () => {
      let got = {};
      const flush = () => {
        if (!Object.keys(got).length) return;
        const g = got; got = {};
        commitSongs(songsRef.current.map(s => (g[s.id] != null ? { ...s, ...(g[s.id] > 0 ? { duration: g[s.id] } : { noDuration: true }) } : s)));
      };
      for (let k = 0; k < todo.length; k++) {
        setScan({ n: k + 1, m: todo.length });
        const s = todo[k];
        if (!songsRef.current.some(x => x.id === s.id)) continue;
        got[s.id] = Math.round(await measure(MUSIC_DIR + s.file, s.size));
        if (k % 10 === 9) flush();
      }
      flush();
      setScan(null);
      scanning.current = false;
    })();
  }, [loaded, progress, songs.length]);

  // Разбор звука на телефоне (modules/stefu-audio): припев, темп, энергия, яркость.
  // Песни без разбора (или разобранные старой версией) — по одной в фоне.
  // Ручной припев (chorus.manual) не перезаписывается.
  const [analysis, setAnalysis] = useState(null);   // { n, m } пока идёт разбор
  const analyzing = useRef(false);
  const [kick, setKick] = useState(0);
  const AV = StefuAudio ? StefuAudio.version() : 0;
  useEffect(() => {
    if (!StefuAudio || !loaded || progress || scan || analyzing.current) return;
    const todo = songsRef.current.filter(s => (s.av || 0) < AV && !s.noAnalysis);
    if (!todo.length) return;
    analyzing.current = true;
    (async () => {
      let got = {};
      const flush = () => {
        if (!Object.keys(got).length) return;
        const g = got; got = {};
        commitSongs(songsRef.current.map(s => (g[s.id] ? { ...s, ...g[s.id](s) } : s)));
      };
      // Два разбора одновременно: декодер у каждого свой, ядер у телефона хватает.
      let next = 0, done = 0;
      const one = async (s) => {
        try {
          const r = await StefuAudio.analyze(MUSIC_DIR + s.file);
          // одна строка в журнал Android — чтобы проверять разбор по adb logcat
          console.log('[analyze]', s.title, '|', s.artist, '|', JSON.stringify(r));
          got[s.id] = (cur) => {
            const p = { av: AV };
            if (r && r.ok) {
              const snd = { ...(cur.sound || {}) };
              if (r.bpm > 0) snd.bpm = r.bpm;
              snd.energy = r.energy; snd.bright = r.bright;
              p.sound = snd;
              if (r.chorusEnd > r.chorusStart && !(cur.chorus && cur.chorus.manual)) {
                p.chorus = { start: r.chorusStart, end: r.chorusEnd, conf: r.confidence };
              }
              if (!cur.duration && r.duration > 0) p.duration = Math.round(r.duration);
            }
            return p;
          };
        } catch (e) {
          got[s.id] = () => ({ noAnalysis: true });
        }
      };
      const worker = async () => {
        while (next < todo.length) {
          const s = todo[next++];
          if (!songsRef.current.some(x => x.id === s.id)) { done++; continue; }
          await one(s);
          done++;
          // Экран обновляем реже: каждый setState перерисовывает все вкладки.
          // Каждое сохранение перерисовывает экраны (~1 с на тысячу песен) — делаем это редко.
          if (done % 10 === 0 || done === todo.length) setAnalysis({ n: done, m: todo.length });
          if (done % 25 === 0) flush();
          await new Promise(res => setTimeout(res, 150));   // отдать очередь интерфейсу и плееру
        }
      };
      setAnalysis({ n: 0, m: todo.length });
      await Promise.all([worker(), worker()]);
      flush();
      setAnalysis(null);
      analyzing.current = false;
      // песни, добавленные во время разбора, — сразу следующим кругом
      if (songsRef.current.some(x => (x.av || 0) < AV && !x.noAnalysis)) setKick(x => x + 1);
    })();
  }, [loaded, progress, scan, songs.length, kick]);

  /** Разобрать заново все песни (например, после обновления разбора). Ручные припевы остаются. */
  const reanalyzeAll = useCallback(() => {
    commitSongs(songsRef.current.map(s => ({ ...s, av: 0, noAnalysis: false })));
    setKick(x => x + 1);
  }, [commitSongs]);

  const updateSong = useCallback((id, patch) => {
    commitSongs(songsRef.current.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, [commitSongs]);

  /** Одна правка сразу для нескольких песен: fn(song) → поля, которые меняются. */
  const updateSongs = useCallback((ids, fn) => {
    const set = new Set(ids);
    commitSongs(songsRef.current.map(s => (set.has(s.id) ? { ...s, ...fn(s) } : s)));
  }, [commitSongs]);

  // ---- Плейлисты: свой порядок песен, одна песня может быть в нескольких.
  const commitLists = useCallback((next) => {
    listsRef.current = next;
    setPlaylists(next);
    AsyncStorage.setItem(K_LISTS, JSON.stringify(next));
  }, []);
  const createPlaylist = useCallback((name, ids = []) => {
    const pl = { id: newId(), name: name.trim() || '…', ids: [...new Set(ids)], createdAt: Date.now() };
    commitLists([...listsRef.current, pl]);
    return pl;
  }, [commitLists]);
  const editPlaylist = useCallback((id, fn) => {
    commitLists(listsRef.current.map(p => (p.id === id ? { ...p, ...fn(p) } : p)));
  }, [commitLists]);
  const renamePlaylist = useCallback((id, name) => editPlaylist(id, () => ({ name: name.trim() || '…' })), [editPlaylist]);
  const deletePlaylist = useCallback((id) => commitLists(listsRef.current.filter(p => p.id !== id)), [commitLists]);
  /** Добавить в конец; уже бывшие в плейлисте не повторяются. Возвращает, сколько добавлено. */
  const addToPlaylist = useCallback((id, ids) => {
    const pl = listsRef.current.find(p => p.id === id);
    if (!pl) return 0;
    const fresh = [...new Set(ids)].filter(x => !pl.ids.includes(x));
    editPlaylist(id, p => ({ ids: [...p.ids, ...fresh] }));
    return fresh.length;
  }, [editPlaylist]);
  const removeFromPlaylist = useCallback((id, songId) => editPlaylist(id, p => ({ ids: p.ids.filter(x => x !== songId) })), [editPlaylist]);
  const movePlaylistItem = useCallback((id, from, to) => editPlaylist(id, p => {
    const a = [...p.ids];
    if (from < 0 || from >= a.length || to < 0 || to >= a.length) return {};
    const [x] = a.splice(from, 1);
    a.splice(to, 0, x);
    return { ids: a };
  }), [editPlaylist]);

  // ---- Ручные веса тегов: 1 — обычно, 0 — не учитывать, 3 — главный.
  const setTagWeight = useCallback((tag, w) => {
    setTagWeights(prev => {
      const next = { ...prev };
      if (w === 1 || w == null) delete next[tag]; else next[tag] = w;
      AsyncStorage.setItem(K_TAGW, JSON.stringify(next));
      return next;
    });
  }, []);

  /**
   * Данные о звучании с компьютера (tools/sound.py → stefu-music-sound.json):
   * песня находится по имени файла, затем по размеру, затем по исполнителю и названию.
   */
  const importSound = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return null;
    const raw = await FileSystem.readAsStringAsync(res.assets[0].uri);
    const data = JSON.parse(raw.replace(/^﻿/, ''));
    const rows = Array.isArray(data) ? data : data.songs;
    if (!Array.isArray(rows)) throw new Error('JSON: songs[]');
    const byName = {}, bySize = {}, byTA = {};
    for (const r of rows) {
      if (r.name) byName[String(r.name).toLowerCase()] = r;
      if (r.size) bySize[r.size] = r;
      if (r.size0) bySize[r.size0] = r;
      if (r.title) byTA[normKey(r.artist) + '|' + normKey(r.title)] = r;
    }
    let matched = 0;
    const next = songsRef.current.map(s => {
      const r = byName[(s.origName || '').toLowerCase()] || bySize[s.size] || byTA[normKey(s.artist) + '|' + normKey(s.title)];
      const snd = r && cleanSound(r);
      if (!snd) return s;
      matched++;
      return { ...s, sound: snd };
    });
    commitSongs(next);
    return { matched, total: rows.length };
  }, [commitSongs]);

  /**
   * Обложки для всех песен без обложки: ищем в интернете по исполнителю и
   * названию и берём только точное совпадение. Файлы песен не переписываются.
   * onStep({ n, m, found }) — для прогресса; shouldStop() — прервать.
   */
  const findCovers = useCallback(async (onStep, shouldStop) => {
    await ensureDirs();
    const todo = songsRef.current.filter(s => !s.cover && s.title && artistsOf(s).length);
    let found = 0;
    for (let k = 0; k < todo.length; k++) {
      if (shouldStop && shouldStop()) break;
      const s = todo[k];
      onStep && onStep({ n: k + 1, m: todo.length, found });
      try {
        const b = await bestCover(artistsOf(s)[0], s.title);
        const img = b && (await downloadImage(b.url) || await downloadImage(b.thumb));
        if (img) {
          const name = s.id + '-' + Date.now().toString(36) + img.ext;
          await FileSystem.moveAsync({ from: img.uri, to: COVERS_DIR + name });
          const cur = songsRef.current.find(x => x.id === s.id);
          if (cur && !cur.cover) { commitSongs(songsRef.current.map(x => (x.id === s.id ? { ...x, cover: name } : x))); found++; }
          else FileSystem.deleteAsync(COVERS_DIR + name, { idempotent: true }).catch(() => {});
        }
      } catch (e) { /* без сети или не нашлось — дальше */ }
      await new Promise(r => setTimeout(r, 350));   // не чаще 3 запросов в секунду
    }
    return { found, total: todo.length };
  }, [commitSongs]);

  const deleteSongs = useCallback(async (ids) => {
    const set = new Set(ids);
    const gone = songsRef.current.filter(s => set.has(s.id));
    commitSongs(songsRef.current.filter(s => !set.has(s.id)));
    if (listsRef.current.some(p => p.ids.some(x => set.has(x)))) {
      commitLists(listsRef.current.map(p => ({ ...p, ids: p.ids.filter(x => !set.has(x)) })));
    }
    for (const s of gone) {
      FileSystem.deleteAsync(MUSIC_DIR + s.file, { idempotent: true }).catch(() => {});
      if (s.cover) FileSystem.deleteAsync(COVERS_DIR + s.cover, { idempotent: true }).catch(() => {});
    }
  }, [commitSongs, commitLists]);

  // Удалённые песни остаются в истории: отчёт за прошлый год не должен
  // меняться оттого, что песню убрали с телефона. Название берём отсюда.
  const [ghosts, setGhosts] = useState({});
  useEffect(() => { AsyncStorage.getItem('sm_ghosts').then(g => g && setGhosts(JSON.parse(g))); }, []);
  const deleteWithGhosts = useCallback(async (ids) => {
    const g = { ...ghosts };
    for (const s of songsRef.current) if (ids.includes(s.id)) g[s.id] = { title: s.title, artist: s.artist, genre: s.genre, tags: s.tags, langs: s.langs };
    setGhosts(g);
    AsyncStorage.setItem('sm_ghosts', JSON.stringify(g));
    await deleteSongs(ids);
  }, [ghosts, deleteSongs]);

  const clearHistory = useCallback(() => {
    playsOk.current = true;           // очистка — по просьбе: записать пустую можно
    playsRef.current = [];
    setPlays([]);
    flushPlays();
    setGhosts({});
    AsyncStorage.removeItem('sm_ghosts');
  }, [flushPlays]);

  const clearAll = useCallback(async () => {
    clearHistory();
    commitSongs([]);
    commitLists([]);
    for (const d of [MUSIC_DIR, COVERS_DIR]) await FileSystem.deleteAsync(d, { idempotent: true }).catch(() => {});
    await ensureDirs();
  }, [clearHistory, commitSongs, commitLists]);

  const derived = useMemo(() => {
    const count = {}, last = {};
    for (const p of plays) {
      if (p.c) count[p.s] = (count[p.s] || 0) + 1;
      if (!last[p.s] || p.t > last[p.s]) last[p.s] = p.t;
    }
    const tagSet = new Map();
    for (const s of songs) for (const tg of s.tags || []) tagSet.set(tg, (tagSet.get(tg) || 0) + 1);
    const allTags = [...tagSet.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const langSet = new Map();
    for (const s of songs) for (const l of s.langs || []) langSet.set(l, (langSet.get(l) || 0) + 1);
    const allLangs = [...langSet.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
    const byId = {};
    for (const s of songs) byId[s.id] = s;
    return { playCount: count, lastPlayed: last, allTags, allLangs, byId, recIndex: buildIndex(songs, plays, tagWeights) };
  }, [songs, plays, tagWeights]);

  /** Копия истории и списка песен — для автокопии и восстановления (src/utils/backup.js). */
  const backupData = useCallback(() => ({
    app: 'Stefu Music', kind: 'backup', v: 2, exportedAt: new Date().toISOString(),
    songs: songsRef.current.map(s => ({ id: s.id, title: s.title, artist: s.artist, origName: s.origName, size: s.size,
      duration: s.duration, genre: s.genre, tags: s.tags, langs: s.langs })),
    ghosts,
    plays: playsRef.current,
  }), [ghosts]);

  /**
   * Восстановить историю из копии или ручного «Экспорта»: прослушивания добавляются к текущим
   * без повторов. Песни после переустановки получают новые id — ищем по имени файла, размеру,
   * исполнителю и названию; не нашлась — прослушивания остаются в отчётах под старым названием.
   */
  const importHistory = useCallback((data) => {
    const rows = Array.isArray(data && data.songs) ? data.songs : [];
    const src = (Array.isArray(data && data.plays) ? data.plays : []).map(p => (p.s != null ? p
      : { s: p.song, t: Date.parse(p.start), d: p.seconds, c: p.counted ? 1 : 0 })).filter(p => p.s && Number.isFinite(p.t));
    if (!src.length) throw new Error('plays');
    const cur = songsRef.current, curIds = new Set(cur.map(s => s.id));
    const byName = {}, bySize = {}, byTA = {};
    for (const s of cur) {
      if (s.origName) byName[s.origName.toLowerCase()] = s.id;
      if (s.size) bySize[s.size] = s.id;
      byTA[normKey(s.artist) + '|' + normKey(s.title)] = s.id;
    }
    const map = {}, newGhosts = {};
    let matched = 0;
    for (const r of rows) {
      const id = curIds.has(r.id) ? r.id
        : byName[(r.origName || '').toLowerCase()] || (r.size && bySize[r.size]) || byTA[normKey(r.artist) + '|' + normKey(r.title)];
      if (id) { map[r.id] = id; matched++; }
      else newGhosts[r.id] = { title: r.title, artist: r.artist, genre: r.genre, tags: r.tags, langs: r.langs };
    }
    const have = new Set(playsRef.current.map(p => p.s + '|' + p.t));
    const add = [];
    for (const p of src) {
      const s = map[p.s] || p.s;
      if (have.has(s + '|' + p.t)) continue;
      have.add(s + '|' + p.t);
      add.push({ id: p.id || newId(), s, t: p.t, d: Math.round(p.d || 0), c: p.c ? 1 : 0 });
    }
    const next = [...playsRef.current, ...add].sort((a, b) => a.t - b.t);
    playsOk.current = true;           // восстановление — по просьбе: записать можно
    playsRef.current = next;
    setPlays(next);
    flushPlays();
    const g = { ...(data.ghosts || {}), ...newGhosts, ...ghosts };
    setGhosts(g);
    AsyncStorage.setItem('sm_ghosts', JSON.stringify(g));
    return { added: add.length, total: src.length, matched, songs: rows.length };
  }, [ghosts, flushPlays]);

  // автокопия раз в неделю (если выбрана папка): через 15 с после загрузки, когда история прочитана
  useEffect(() => {
    if (!loaded || !playsOk.current) return;
    const h = setTimeout(() => { maybeAutoBackup(backupData).catch(() => {}); }, 15000);
    return () => clearTimeout(h);
  }, [loaded]);

  const value = useMemo(() => ({
    songs, plays, loaded, progress, scan, ghosts, playlists, tagWeights, analysis, canAnalyze: !!StefuAudio, reanalyzeAll, ...derived,
    importMusic, importFolder, updateSong, updateSongs, deleteSongs: deleteWithGhosts, recordListen, clearHistory, clearAll,
    createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, movePlaylistItem,
    setTagWeight, importSound, findCovers, backupData, importHistory,
    songUri: s => MUSIC_DIR + s.file,
    coverUri: s => (s && s.cover ? COVERS_DIR + s.cover : null),
    getSong: id => songsRef.current.find(s => s.id === id),
  }), [songs, plays, loaded, progress, scan, ghosts, playlists, tagWeights, analysis, reanalyzeAll, derived, importMusic, importFolder, updateSong, updateSongs, deleteWithGhosts, recordListen, clearHistory, clearAll,
    createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, movePlaylistItem, setTagWeight, importSound, findCovers, backupData, importHistory]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLibrary = () => useContext(Ctx);
