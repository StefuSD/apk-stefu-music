import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { readTags, mp3Duration } from '../utils/id3';
import { createAudioPlayer } from 'expo-audio';
import { buildIndex } from '../utils/recommend';
import { splitArtists, joinArtists } from '../utils/artists';

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
export const MUSIC_DIR = FileSystem.documentDirectory + 'music/';
export const COVERS_DIR = FileSystem.documentDirectory + 'covers/';

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

const Ctx = createContext(null);

export function LibraryProvider({ children }) {
  const [songs, setSongs] = useState([]);
  const [plays, setPlays] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(null);   // { n, m } во время импорта
  const [scan, setScan] = useState(null);           // { n, m } пока досчитываем длительность
  const playsRef = useRef([]);
  const songsRef = useRef([]);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        await ensureDirs();
        const [s, p] = await Promise.all([AsyncStorage.getItem(K_SONGS), AsyncStorage.getItem(K_PLAYS)]);
        let ss = s ? JSON.parse(s) : [];
        // Старые записи: одна строка «A & B» → отдельные исполнители и показ через «·».
        let migrated = false;
        ss = ss.map(x => {
          if (x.artists) return x;
          migrated = true;
          const artists = splitArtists(x.artist);
          return { ...x, artists, artist: joinArtists(artists) };
        });
        if (migrated) AsyncStorage.setItem(K_SONGS, JSON.stringify(ss));
        const pp = p ? JSON.parse(p) : [];
        songsRef.current = ss; playsRef.current = pp;
        setSongs(ss); setPlays(pp);
      } catch (e) { /* пустая библиотека */ }
      setLoaded(true);
    })();
  }, []);

  const commitSongs = useCallback((next) => {
    songsRef.current = next;
    setSongs(next);
    AsyncStorage.setItem(K_SONGS, JSON.stringify(next));
  }, []);

  const flushPlays = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    AsyncStorage.setItem(K_PLAYS, JSON.stringify(playsRef.current));
  }, []);

  // История пишется часто (каждые несколько секунд игры) — на диск
  // откладываем, а при уходе из приложения сбрасываем сразу.
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') flushPlays(); });
    return () => sub.remove();
  }, [flushPlays]);

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
    let added = 0, dup = 0;
    const fresh = [];
    const isDup = (name, size) => fresh.concat(songsRef.current).some(s => s.origName === name && s.size === size);
    for (let k = 0; k < list.length; k++) {
      setProgress({ n: k + 1, m: list.length });
      const a = list[k];
      try {
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
    return { added, dup };
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

  const updateSong = useCallback((id, patch) => {
    commitSongs(songsRef.current.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }, [commitSongs]);

  const deleteSongs = useCallback(async (ids) => {
    const set = new Set(ids);
    const gone = songsRef.current.filter(s => set.has(s.id));
    commitSongs(songsRef.current.filter(s => !set.has(s.id)));
    for (const s of gone) {
      FileSystem.deleteAsync(MUSIC_DIR + s.file, { idempotent: true }).catch(() => {});
      if (s.cover) FileSystem.deleteAsync(COVERS_DIR + s.cover, { idempotent: true }).catch(() => {});
    }
  }, [commitSongs]);

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
    playsRef.current = [];
    setPlays([]);
    flushPlays();
    setGhosts({});
    AsyncStorage.removeItem('sm_ghosts');
  }, [flushPlays]);

  const clearAll = useCallback(async () => {
    clearHistory();
    commitSongs([]);
    for (const d of [MUSIC_DIR, COVERS_DIR]) await FileSystem.deleteAsync(d, { idempotent: true }).catch(() => {});
    await ensureDirs();
  }, [clearHistory, commitSongs]);

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
    return { playCount: count, lastPlayed: last, allTags, allLangs, byId, recIndex: buildIndex(songs, plays) };
  }, [songs, plays]);

  const value = useMemo(() => ({
    songs, plays, loaded, progress, scan, ghosts, ...derived,
    importMusic, importFolder, updateSong, deleteSongs: deleteWithGhosts, recordListen, clearHistory, clearAll,
    songUri: s => MUSIC_DIR + s.file,
    coverUri: s => (s && s.cover ? COVERS_DIR + s.cover : null),
    getSong: id => songsRef.current.find(s => s.id === id),
  }), [songs, plays, loaded, progress, scan, ghosts, derived, importMusic, importFolder, updateSong, deleteWithGhosts, recordListen, clearHistory, clearAll]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLibrary = () => useContext(Ctx);
