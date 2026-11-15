import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync, createAudioPlayer } from 'expo-audio';
import { useLibrary } from './LibraryContext';
import * as FileSystem from 'expo-file-system/legacy';
import DEFAULT_ART from '../utils/defaultArtwork';
import { snippetRange, SNIP_FADE_IN, SNIP_FADE_OUT } from '../utils/snippet';
import { usePro } from '../pro/ProContext';
import { dayKey } from '../utils/format';

const K_SNIP_DAY = 'sm_snip_day';   // { d: день, n: сколько сниппетов сыграно } — бесплатный объём
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import PlayerWidget from '../widget/PlayerWidget';
import { K_WIDGET } from '../widget/widgetTaskHandler';

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
const K_XFADE = 'sm_xfade';   // секунды плавного перехода между песнями, 0 — выключен
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
  const [ready, setReady] = useState(false);       // очередь восстановлена — ссылкам можно включать музыку
  // Таймер сна: { at: время остановки (ms) } или { end: true } — после этой песни.
  const [sleep, setSleepState] = useState(null);
  const [crossfade, setCrossfadeState] = useState(0);
  const [snippets, setSnippetsState] = useState(false);   // режим «Только сниппеты»
  // Бесплатный объём сниппетов в день (src/pro/pro.js → free.snippetsDay). Pro — без ограничения.
  const pro = usePro();
  const proRef = useRef(pro);
  proRef.current = pro;
  const [snipUsed, setSnipUsed] = useState(0);
  const quota = useRef({ d: '', n: 0 });
  useEffect(() => {
    AsyncStorage.getItem(K_SNIP_DAY).then(raw => {
      try { const q = JSON.parse(raw); if (q && q.d === dayKey(Date.now())) { quota.current = q; setSnipUsed(q.n); } } catch (e) { /* */ }
    }).catch(() => {});
  }, []);
  const usedToday = () => (quota.current.d === dayKey(Date.now()) ? quota.current.n : 0);
  /** Можно ли сыграть ещё один сниппет; нет — окно Pro, режим выключается. */
  const takeSnippet = () => {
    const used = usedToday();
    if (!proRef.current.requireRoom('snippetsDay', used)) return false;
    quota.current = { d: dayKey(Date.now()), n: used + 1 };
    setSnipUsed(used + 1);
    AsyncStorage.setItem(K_SNIP_DAY, JSON.stringify(quota.current)).catch(() => {});
    return true;
  };
  const st = useRef({ queue: [], index: -1, repeat: 'all', orig: null, lockActive: false, trim: {}, sleep: null, xfade: 0, xf: null, snip: false });

  /**
   * Какой кусок песни играть: ts..te, плавные вход/выход и обрезан ли конец (cut).
   * Обычно — обрезка из карточки песни, в режиме «Только припевы» — припев.
   */
  const range = (song, dur) => {
    if (st.current.snip) {
      const [a, b] = snippetRange(song, dur);
      return { ts: a, te: b, fin: SNIP_FADE_IN, fout: SNIP_FADE_OUT, cut: true };
    }
    const te = song.trimEnd && (!dur || song.trimEnd < dur) ? song.trimEnd : dur;
    return { ts: song.trimStart || 0, te, fin: song.fadeIn || 0, fout: song.fadeOut || 0, cut: !!song.trimEnd };
  };
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

  // Сторож: если JavaScript подвис дольше 0,7 с (полоса перемотки встаёт), пишем в журнал
  // Android строку «[lag] мс» — смотреть через adb logcat.
  useEffect(() => {
    let last = Date.now();
    const iv = setInterval(() => {
      const now = Date.now();
      if (now - last > 1700) console.log('[lag]', now - last - 1000, 'ms');
      last = now;
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(K_XFADE).then(v => { const n = Number(v) || 0; st.current.xfade = n; setCrossfadeState(n); }).catch(() => {});
  }, []);

  /**
   * Кроссфейд: хвост уходящей песни доигрывает второй, временный плеер и
   * затихает, а основной уже играет следующую песню и набирает громкость.
   * Шторка и учёт прослушиваний остаются на основном плеере.
   */
  const killTail = () => {
    const xf = st.current.xf;
    if (xf && xf.tail) { try { xf.tail.pause(); xf.tail.remove(); } catch (e) { /* уже освобождён */ } }
    st.current.xf = null;
  };

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
  const load = useCallback((q, i, play = true, fromXfade = false) => {
    const id = q[i];
    const song = libRef.current.getSong(id);
    if (!song) return false;
    if (!fromXfade) killTail();
    // Сниппеты сверх бесплатного объёма: режим выключается, музыка встаёт, открыто окно Pro.
    if (st.current.snip && play && !takeSnippet()) {
      st.current.snip = false; setSnippetsState(false);
      killTail(); closeSession(); player.pause();
      return false;
    }
    closeSession();
    setQ(q, i);
    player.replace({ uri: libRef.current.songUri(song) });
    // Обрезка: начинаем с trimStart; пока перемотка не сработала — тишина,
    // чтобы не было слышно первых долей секунды обрезанного начала.
    const r0 = range(song, song.duration || 0);
    st.current.trim = { songId: id, applied: !r0.ts, ended: false };
    if (r0.ts) { player.volume = 0; player.seekTo(r0.ts).catch(() => {}); }
    else player.volume = r0.fin || fromXfade ? 0 : 1;
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
    }).catch(() => {}).finally(() => setReady(true));
  }, [lib.loaded]);

  const next = useCallback((auto = false, fromXfade = false) => {
    const { queue: q, index: i } = st.current;
    if (!q.length) return;
    let j = i + 1;
    // Пропускаем песни, которые успели удалить.
    while (j < q.length && !libRef.current.byId[q[j]]) j++;
    if (j >= q.length) {
      if (auto && st.current.repeat === 'off') { closeSession(); player.pause(); player.seekTo(0); return; }
      j = 0;
    }
    load(q, j, true, fromXfade);
  }, [load, player]);

  /** Есть ли куда переходить после текущей песни (для кроссфейда). */
  const hasNext = () => {
    const { queue: q, index: i, repeat: r } = st.current;
    if (r === 'one') return false;
    for (let j = i + 1; j < q.length; j++) if (libRef.current.byId[q[j]]) return true;
    return r === 'all' && q.length > 1;
  };

  /** Начать кроссфейд: хвост — во временный плеер, основной — на следующую песню. */
  const startXfade = (song, at, vol) => {
    const dur = st.current.xfade;
    let tail;
    try { tail = createAudioPlayer({ uri: libRef.current.songUri(song) }, { updateInterval: 250 }); } catch (e) { return false; }
    st.current.xf = { tail, start: 0, dur, vol, pending: true };
    tail.volume = 0;
    tail.seekTo(at).catch(() => {});
    tail.play();
    // Переключаем основной, когда хвост действительно зазвучал (или через 1,2 с).
    let done = false;
    const sw = () => {
      if (done) return;
      done = true;
      try { sub.remove(); } catch (e) { /* */ }
      const xf = st.current.xf;
      if (!xf || xf.tail !== tail) return;
      tail.volume = vol;
      xf.pending = false;
      xf.start = Date.now();
      next(true, true);
    };
    const sub = tail.addListener('playbackStatusUpdate', (s) => { if (s.playing && (s.currentTime || 0) >= at - 0.3) sw(); });
    setTimeout(sw, 1200);
    return true;
  };

  const prev = useCallback(() => {
    const { queue: q, index: i } = st.current;
    if (!q.length) return;
    const cur = libRef.current.byId[q[i]];
    const from = cur ? range(cur, cur.duration || 0).ts : 0;
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
      const dur0 = s.duration > 0 ? s.duration : 0;
      const pos = s.currentTime || 0;
      const rg = cs ? range(cs, dur0) : null;
      const teAll = rg ? rg.te : dur0;
      let vol = 1;
      if (rg && (rg.ts || rg.cut || rg.fin || rg.fout)) {
        const tr = st.current.trim;
        const ts = rg.ts;
        const te = teAll;
        if (tr.songId === curId && !tr.applied && dur0 > 0) {
          if (pos < ts - 0.5) player.seekTo(ts).catch(() => {});
          else tr.applied = true;
        }
        vol = tr.applied ? 1 : 0;
        if (tr.applied && rg.fin) vol = Math.min(vol, Math.max(0, (pos - ts) / rg.fin));
        if (rg.fout && te) vol = Math.min(vol, Math.max(0, (te - pos) / rg.fout));
        if (rg.cut && te && s.playing && pos >= te - 0.2 && !tr.ended && tr.songId === curId) { tr.ended = true; cutEnd = true; }
      }
      // Кроссфейд: основной набирает громкость, хвост во временном плеере затихает.
      const xf = st.current.xf;
      if (xf && !xf.pending) {
        const k = Math.min(1, (Date.now() - xf.start) / (xf.dur * 1000));
        vol = Math.min(vol, k);
        try { xf.tail.volume = Math.max(0, xf.vol * (1 - k)); } catch (e) { /* */ }
        if (k >= 1) killTail();
      }
      // Таймер сна: последние 10 секунд громкость плавно уходит, потом пауза.
      const sl = st.current.sleep;
      if (sl && sl.at) {
        const left = (sl.at - Date.now()) / 1000;
        if (left <= 0) {
          st.current.sleep = null; setSleepState(null);
          killTail(); player.pause(); player.volume = 1;
          return;
        }
        if (left < 10) vol = Math.min(vol, left / 10);
      }
      vol = Math.max(0, Math.min(1, vol));
      if (Math.abs((player.volume ?? 1) - vol) > 0.01) player.volume = vol;
      // Пора начинать кроссфейд: до конца песни (с учётом обрезки) осталось xfade секунд.
      if (st.current.xfade > 0 && !st.current.xf && s.playing && cs && teAll > st.current.xfade * 3
        && teAll - pos <= st.current.xfade && teAll - pos > 0.5 && hasNext() && !(sl && sl.end)
        && (!st.current.trim || st.current.trim.songId !== curId || st.current.trim.applied !== false)) {
        if (startXfade(cs, pos + 0.25, vol)) return;
      }
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
        if (st.current.sleep && st.current.sleep.end) {
          // Таймер сна «после этой песни».
          st.current.sleep = null; setSleepState(null);
          closeSession(); player.pause(); player.seekTo(rg ? rg.ts : 0);
          return;
        }
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
    // Обычный запуск выключает «Только припевы»; запуск припевов — включает.
    const snip = !!opts.snippets;
    if (snip !== st.current.snip) { st.current.snip = snip; setSnippetsState(snip); }
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

  /** Перемотка. В режиме сниппетов увод ползунка за пределы сниппета выключает режим:
      песня дальше играет целиком с выбранного места (иначе приглушение и «конец сниппета»
      сбивали громкость и прогресс). */
  const seek = useCallback((sec) => {
    const t = Math.max(0, sec);
    if (st.current.snip) {
      const song = libRef.current.byId[st.current.queue[st.current.index]];
      if (song) {
        const [a, b] = snippetRange(song, player.duration || song.duration);
        if (t < a - 0.5 || t > b) {
          st.current.snip = false; setSnippetsState(false);
          st.current.trim = { songId: song.id, applied: true, ended: false };
          player.volume = 1;
        }
      }
    }
    player.seekTo(t);
  }, [player]);

  /** Крестик в мини-плеере: остановить, убрать плашку и уведомление в шторке. Очередь остаётся. */
  const stop = useCallback(() => {
    killTail();
    closeSession();
    player.pause();
    setQ(st.current.queue, -1);
    try { player.clearLockScreenControls(); } catch (e) { /* шторки не было */ }
    st.current.lockActive = false;
  }, [player]);

  /** Таймер сна: минуты, 'end' — после этой песни, null — выключить. */
  const setSleep = useCallback((v) => {
    const s = v == null ? null : v === 'end' ? { end: true } : { at: Date.now() + v * 60000 };
    st.current.sleep = s;
    setSleepState(s);
    if (!s && (player.volume ?? 1) < 1) player.volume = 1;
  }, [player]);

  // Время таймера вышло, пока музыка стояла на паузе, — просто выключаем таймер.
  useEffect(() => {
    if (!sleep || !sleep.at) return;
    const tm = setTimeout(() => {
      if (st.current.sleep !== sleep) return;
      st.current.sleep = null; setSleepState(null);
      if (player.playing) { killTail(); player.pause(); }
      player.volume = 1;
    }, Math.max(0, sleep.at - Date.now() + 1500));
    return () => clearTimeout(tm);
  }, [sleep, player]);

  /** Включить/выключить «Только припевы» для того, что уже играет. */
  const setSnippets = useCallback((on) => {
    st.current.snip = !!on; setSnippetsState(!!on);
    const { queue: q, index: i } = st.current;
    const song = libRef.current.byId[q[i]];
    if (!song) return;
    if (on) {
      if (!takeSnippet()) { st.current.snip = false; setSnippetsState(false); return; }
      // сразу на сниппет текущей песни
      const [a] = snippetRange(song, player.duration || song.duration);
      st.current.trim = { songId: song.id, applied: true, ended: false };
      player.seekTo(a).catch(() => {});
      if (!player.playing) player.play();
    } else {
      st.current.trim = { songId: song.id, applied: true, ended: false };
    }
  }, [player]);

  /** «Слушать целиком»: выйти из припевов и начать текущую песню сначала. */
  const playFull = useCallback(() => {
    st.current.snip = false; setSnippetsState(false);
    const { queue: q, index: i } = st.current;
    if (q[i]) load(q, i, true);
  }, [load]);

  /** «С припева»: перемотать текущую песню на припев. */
  const seekChorus = useCallback(() => {
    const song = libRef.current.byId[st.current.queue[st.current.index]];
    if (!song) return;
    const [a] = snippetRange(song, player.duration || song.duration);
    player.seekTo(Math.max(0, a - 0.3)).catch(() => {});
    if (!player.playing) player.play();
  }, [player]);

  const setCrossfade = useCallback((sec) => {
    st.current.xfade = sec;
    setCrossfadeState(sec);
    AsyncStorage.setItem(K_XFADE, String(sec)).catch(() => {});
    if (!sec) killTail();
  }, []);

  const value = useMemo(() => ({
    queue, index, currentId, shuffle, repeat, ready, sleep, crossfade, snippets, snipUsed,
    playList, toggle, next: () => next(false), prev, seek, stop, toggleShuffle, cycleRepeat, playNext, setSleep, setCrossfade,
    setSnippets, playFull, seekChorus,
  }), [queue, index, currentId, shuffle, repeat, ready, sleep, crossfade, snippets, snipUsed, playList, toggle, next, prev, seek, stop, toggleShuffle, cycleRepeat, playNext, setSleep, setCrossfade,
    setSnippets, playFull, seekChorus]);

  // ---- Виджет на рабочем столе: команды кнопок и обновление при смене песни или паузе.
  const cmds = useRef({});
  cmds.current = { toggle, next: () => next(false), prev };
  const widgetState = () => {
    const song = libRef.current.byId[st.current.queue[st.current.index]];
    return { title: song ? song.title : '', artist: song ? song.artist : '', playing: !!player.playing };
  };
  useEffect(() => {
    global.__stefuWidget = {
      cmd: (a) => {
        if (a === 'TOGGLE') cmds.current.toggle();
        else if (a === 'NEXT') cmds.current.next();
        else if (a === 'PREV') cmds.current.prev();
      },
      state: widgetState,
    };
    return () => { global.__stefuWidget = null; };
  }, [player]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const s = widgetState();
    s.playing = !!status.playing;
    AsyncStorage.setItem(K_WIDGET, JSON.stringify({ title: s.title, artist: s.artist })).catch(() => {});
    requestWidgetUpdate({ widgetName: 'Player', renderWidget: () => <PlayerWidget {...s} live /> }).catch(() => {});
  }, [currentId, status.playing, lib.byId]);

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
