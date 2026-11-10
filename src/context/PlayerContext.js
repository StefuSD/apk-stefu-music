import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useLibrary } from './LibraryContext';
import * as FileSystem from 'expo-file-system/legacy';
import DEFAULT_ART from '../utils/defaultArtwork';

/**
 * Плеер: один на всё приложение.
 *
 * Очередь — список id песен (тот, из которого начали играть). Музыка
 * продолжает играть в фоне и при выключенном экране, управление — в шторке
 * и на экране блокировки (служба expo-audio).
 *
 * Прослушивание считаем по реально сыгранным секундам (часы стены между
 * обновлениями, не больше 2 с за шаг — перемотка не засчитывается).
 * Засчитано, когда сыграно 30 секунд или половина короткой песни.
 */

const K_STATE = 'sm_player';
const PlayerCtx = createContext(null);
const StatusCtx = createContext(null);

const shuffled = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

export function PlayerProvider({ children }) {
  const lib = useLibrary();
  const libRef = useRef(lib);
  libRef.current = lib;

  // 250 мс — достаточно часто, чтобы плавное начало/конец звучали ровно.
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);

  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('all');    // off | all | one
  const [currentId, setCurrentId] = useState(null);
  const st = useRef({ queue: [], index: -1, repeat: 'all', orig: null, lockActive: false, trim: {} });
  const session = useRef(null);
  const restored = useRef(false);

  // Тёмная обложка по умолчанию для шторки и экрана блокировки. Android
  // красит карточку плеера по картинке: без неё карточка выходила светлой
  // с белым нечитаемым текстом (а expo-audio оставлял обложку прошлой песни).
  const defaultArt = useRef(null);
  useEffect(() => {
    const path = FileSystem.documentDirectory + 'artwork-black.jpg';
    FileSystem.writeAsStringAsync(path, DEFAULT_ART, { encoding: FileSystem.EncodingType.Base64 })
      .then(() => { defaultArt.current = path; })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const saveState = () => {
    AsyncStorage.setItem(K_STATE, JSON.stringify({
      queue: st.current.queue, index: st.current.index, repeat: st.current.repeat, shuffle: !!st.current.orig,
    })).catch(() => {});
  };

  const setQ = (q, i) => {
    st.current.queue = q; st.current.index = i;
    setQueue(q); setIndex(i);
    setCurrentId(q[i] || null);
    saveState();
  };

  const closeSession = () => {
    const s = session.current;
    if (s && s.sec >= 5) libRef.current.recordListen(s);
    session.current = null;
  };

  const lockMeta = (song) => ({
    title: song.title,
    artist: song.artist || undefined,
    albumTitle: song.album || undefined,
    artworkUrl: libRef.current.coverUri(song) || defaultArt.current || undefined,
  });

  // Шторка и экран блокировки: включаем при первом запуске игры.
  const showLock = (song) => {
    const meta = lockMeta(song);
    if (meta.artworkUrl && !/^(file|https?):\/\//.test(meta.artworkUrl)) delete meta.artworkUrl;
    const apply = (m) => {
      if (!st.current.lockActive) {
        player.setActiveForLockScreen(true, m, { showSeekForward: true, showSeekBackward: true });
        st.current.lockActive = true;
      } else player.updateLockScreenMetadata(m);
    };
    try { apply(meta); } catch (e) {
      // Обложка не подошла — шторка важнее картинки.
      try { const { artworkUrl, ...plain } = meta; apply(plain); } catch (e2) { /* без шторки */ }
    }
  };


  /** Загрузить песню очереди под номером i; play — сразу играть. */
  const load = useCallback((q, i, play = true) => {
    const id = q[i];
    const song = libRef.current.getSong(id);
    if (!song) return false;
    closeSession();
    setQ(q, i);
    player.replace({ uri: libRef.current.songUri(song) });
    // Обрезка: начинаем с trimStart; пока перемотка не сработала — тишина,
    // чтобы не было слышно первых долей секунды обрезанного начала.
    st.current.trim = { songId: id, applied: !song.trimStart, ended: false };
    if (song.trimStart) { player.volume = 0; player.seekTo(song.trimStart).catch(() => {}); }
    else player.volume = song.fadeIn ? 0 : 1;
    if (play) {
      player.play();
      session.current = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), songId: id, start: Date.now(), sec: 0, saved: 0, counted: false, tick: null };
    }
    if (play || st.current.lockActive) showLock(song);
    return true;
  }, [player]);

  // Восстановить очередь после перезапуска — без автозапуска.
  useEffect(() => {
    if (!lib.loaded || restored.current) return;
    restored.current = true;
    AsyncStorage.getItem(K_STATE).then(raw => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        const q = (s.queue || []).filter(id => lib.byId[id]);
        st.current.repeat = s.repeat || 'all'; setRepeat(st.current.repeat);
        if (s.shuffle) { st.current.orig = q; setShuffle(true); }
        // Плашку закрыли крестиком — после перезапуска её не показываем.
        if (s.index < 0) { if (q.length) setQ(q, -1); return; }
        const curId = (s.queue || [])[s.index];
        const i = Math.max(0, q.indexOf(curId));
        if (q.length) load(q, i, false);
      } catch (e) { /* без очереди */ }
    });
  }, [lib.loaded]);

  const next = useCallback((auto = false) => {
    const { queue: q, index: i } = st.current;
    if (!q.length) return;
    let j = i + 1;
    // Пропускаем песни, которые успели удалить.
    while (j < q.length && !libRef.current.byId[q[j]]) j++;
    if (j >= q.length) {
      if (auto && st.current.repeat === 'off') { closeSession(); player.pause(); player.seekTo(0); return; }
      j = 0;
    }
    load(q, j, true);
  }, [load, player]);

  const prev = useCallback(() => {
    const { queue: q, index: i } = st.current;
    if (!q.length) return;
    const cur = libRef.current.byId[q[i]];
    const from = (cur && cur.trimStart) || 0;
    if ((player.currentTime || 0) > from + 4 || i <= 0) { player.seekTo(from); return; }
    load(q, i - 1, true);
  }, [load, player]);

  // Учёт прослушивания и переход к следующей песне.
  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      // Кнопки «предыдущая/следующая» в шторке (патч expo-audio, patches/).
      if (s.remoteCommand === 'next') { next(false); return; }
      if (s.remoteCommand === 'previous') { prev(); return; }
      const ses = session.current;
      const now = Date.now();
      // Обрезка и плавные начало/конец (песня: trimStart, trimEnd, fadeIn, fadeOut — в секундах).
      let cutEnd = false;
      const curId = st.current.queue[st.current.index];
      const cs = libRef.current.byId[curId];
      if (cs && (cs.trimStart || cs.trimEnd || cs.fadeIn || cs.fadeOut)) {
        const tr = st.current.trim;
        const dur = s.duration > 0 ? s.duration : 0;
        const ts = cs.trimStart || 0;
        const te = cs.trimEnd && (!dur || cs.trimEnd < dur) ? cs.trimEnd : dur;
        const now2 = s.currentTime || 0;
        if (tr.songId === curId && !tr.applied && dur > 0) {
          if (now2 < ts - 0.5) player.seekTo(ts).catch(() => {});
          else tr.applied = true;
        }
        let vol = tr.applied ? 1 : 0;
        if (tr.applied && cs.fadeIn) vol = Math.min(vol, Math.max(0, (now2 - ts) / cs.fadeIn));
        if (cs.fadeOut && te) vol = Math.min(vol, Math.max(0, (te - now2) / cs.fadeOut));
        vol = Math.max(0, Math.min(1, vol));
        if (Math.abs((player.volume ?? 1) - vol) > 0.01) player.volume = vol;
        if (cs.trimEnd && te && s.playing && now2 >= te - 0.2 && !tr.ended && tr.songId === curId) { tr.ended = true; cutEnd = true; }
      } else if ((player.volume ?? 1) !== 1) player.volume = 1;
      if (ses) {
        if (s.playing) {
          if (ses.tick) ses.sec += Math.min((now - ses.tick) / 1000, 2);
          ses.tick = now;
        } else ses.tick = null;
        const dur = s.duration > 0 ? s.duration : 0;
        const need = dur > 0 ? Math.min(30, dur * 0.5) : 30;
        const wasCounted = ses.counted;
        if (ses.sec >= need) ses.counted = true;
        if (ses.sec >= 5 && (ses.sec - ses.saved >= 10 || ses.counted !== wasCounted)) {
          ses.saved = ses.sec;
          libRef.current.recordListen(ses);
        }
        const song = libRef.current.byId[ses.songId];
        if (song && dur > 0 && !song.duration) libRef.current.updateSong(song.id, { duration: Math.round(dur) });
      }
      if (s.didJustFinish || cutEnd) {
        if (st.current.repeat === 'one') {
          const { queue: q, index: i } = st.current;
          load(q, i, true);
        } else next(true);
      }
    });
    return () => sub.remove();
  }, [player, next, prev, load]);

  // Нажали «играть» в шторке, когда сеанса не было (после восстановления
  // очереди или после паузы в конце списка) — начинаем новый.
  useEffect(() => {
    if (status.playing && !session.current && st.current.queue[st.current.index]) {
      const song = libRef.current.byId[st.current.queue[st.current.index]];
      if (song && !st.current.lockActive) showLock(song);
      session.current = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), songId: st.current.queue[st.current.index], start: Date.now(), sec: 0, saved: 0, counted: false, tick: null };
    }
  }, [status.playing]);

  // Текущую песню удалили — останавливаемся.
  useEffect(() => {
    if (currentId && lib.loaded && !lib.byId[currentId]) {
      closeSession();
      player.pause();
      const q = st.current.queue.filter(id => lib.byId[id]);
      setQ(q, -1);
      try { player.clearLockScreenControls(); st.current.lockActive = false; } catch (e) { /* */ }
    }
  }, [lib.byId]);

  const playList = useCallback((ids, startId, opts = {}) => {
    if (!ids.length) return;
    if (opts.shuffle) {
      const first = startId || ids[Math.floor(Math.random() * ids.length)];
      const rest = shuffled(ids.filter(x => x !== first));
      st.current.orig = ids; setShuffle(true);
      load([first, ...rest], 0, true);
      return;
    }
    if (st.current.orig) {
      // Включено «вперемешку»: начатая песня первая, остальные — в случайном порядке.
      const first = startId || ids[0];
      st.current.orig = ids;
      load([first, ...shuffled(ids.filter(x => x !== first))], 0, true);
      return;
    }
    load(ids, Math.max(0, ids.indexOf(startId)), true);
  }, [load]);

  const toggle = useCallback(() => {
    if (!st.current.queue.length) return;
    if (st.current.index < 0) { load(st.current.queue, 0, true); return; }
    if (player.playing) player.pause(); else player.play();
  }, [player, load]);

  const toggleShuffle = useCallback(() => {
    const { queue: q, index: i } = st.current;
    const cur = q[i];
    if (st.current.orig) {
      const orig = st.current.orig.filter(id => libRef.current.byId[id]);
      st.current.orig = null; setShuffle(false);
      setQ(orig, Math.max(0, orig.indexOf(cur)));
    } else {
      st.current.orig = q; setShuffle(true);
      const rest = shuffled(q.filter(x => x !== cur));
      setQ(cur ? [cur, ...rest] : rest, 0);
    }
  }, []);

  const cycleRepeat = useCallback(() => {
    const r = { off: 'all', all: 'one', one: 'off' }[st.current.repeat];
    st.current.repeat = r; setRepeat(r);
    saveState();
  }, []);

  const playNext = useCallback((id) => {
    const { queue: q, index: i } = st.current;
    if (!q.length || i < 0) { load([id], 0, true); return; }
    if (q[i] === id) return;
    const before = q.slice(0, i).filter(x => x !== id);
    const after = q.slice(i + 1).filter(x => x !== id);
    setQ([...before, q[i], id, ...after], before.length);
    if (st.current.orig && !st.current.orig.includes(id)) st.current.orig = [...st.current.orig, id];
  }, [load]);

  const seek = useCallback((sec) => { player.seekTo(Math.max(0, sec)); }, [player]);

  /** Крестик в мини-плеере: остановить, убрать плашку и уведомление в шторке. Очередь остаётся. */
  const stop = useCallback(() => {
    closeSession();
    player.pause();
    setQ(st.current.queue, -1);
    try { player.clearLockScreenControls(); } catch (e) { /* шторки не было */ }
    st.current.lockActive = false;
  }, [player]);

  const value = useMemo(() => ({
    queue, index, currentId, shuffle, repeat,
    playList, toggle, next: () => next(false), prev, seek, stop, toggleShuffle, cycleRepeat, playNext,
  }), [queue, index, currentId, shuffle, repeat, playList, toggle, next, prev, seek, stop, toggleShuffle, cycleRepeat, playNext]);

  const statusValue = useMemo(() => ({
    playing: status.playing, currentTime: status.currentTime || 0, duration: status.duration || 0,
    buffering: status.isBuffering,
  }), [status.playing, status.currentTime, status.duration, status.isBuffering]);

  return (
    <PlayerCtx.Provider value={value}>
      <StatusCtx.Provider value={statusValue}>{children}</StatusCtx.Provider>
    </PlayerCtx.Provider>
  );
}

export const usePlayer = () => useContext(PlayerCtx);
export const usePlayerStatus = () => useContext(StatusCtx);
