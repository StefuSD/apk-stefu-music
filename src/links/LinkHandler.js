import { useEffect, useRef, useState } from 'react';
import { Linking, ToastAndroid } from 'react-native';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { useLang } from '../i18n';
import { radioQueue } from '../utils/recommend';
import { langName } from '../utils/languages';
import { usePro } from '../pro/ProContext';
import { parseLink, pickSongs, hasFilter, norm } from './links';

const toast = (msg) => { try { ToastAndroid.show(msg, ToastAndroid.SHORT); } catch (e) { /* не Android */ } };

/**
 * Выполняет ссылки com.stefu.music://… (src/links/links.js): при запуске по
 * ссылке и когда ссылка приходит в уже открытое приложение. Ждёт, пока
 * загрузится библиотека, восстановится очередь и навигация будет готова —
 * иначе восстановленная очередь перебила бы заказанную песню.
 * Каждая ссылка выполняется один раз.
 */
export default function LinkHandler({ navRef, navReady, openPlayer }) {
  const lib = useLibrary();
  const player = usePlayer();
  const { playing } = usePlayerStatus();
  const { t, lang } = useLang();
  const pro = usePro();
  const [pending, setPending] = useState([]);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL().then(u => { if (alive && u) setPending(p => [...p, u]); }).catch(() => {});
    const sub = Linking.addEventListener('url', e => { if (e && e.url) setPending(p => [...p, e.url]); });
    return () => { alive = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (!pending.length || !lib.loaded || !player.ready || !navReady) return;
    const urls = pending;
    setPending([]);
    for (const u of urls) {
      try { run(parseLink(u)); } catch (e) { /* плохая ссылка — просто открыли приложение */ }
    }
  }, [pending, lib.loaded, player.ready, navReady]);

  const go = (screen, params) => { try { navRef.navigate(screen, params); } catch (e) { /* */ } };
  const uiLangName = l => langName(l, lang);

  /** Фильтр библиотеки по ссылке: 'fav', 'tag:<тег как в библиотеке>', 'lang:<код>' или 'all'. */
  const filterFor = (a) => {
    if (a.fav) return 'fav';
    if (a.tag) {
      const tg = lib.allTags.find(x => norm(x) === norm(a.tag));
      if (tg) return 'tag:' + tg;
    }
    if (a.lang && lib.allLangs.includes(a.lang)) return 'lang:' + a.lang;
    return 'all';
  };
  const searchText = a => [a.q, a.title, a.artist, a.album, a.genre, (a.tag && filterFor(a) === 'all') ? a.tag : '']
    .filter(Boolean).join(' ');

  const showSearch = (a) => go('Music', { linkSearch: { q: searchText(a), filter: filterFor(a) }, linkAt: Date.now() });

  /** Играть список: первая песня — лучшая находка; «вперемешку» — первая случайная. */
  const start = (ids, shuffle) => {
    if (!ids.length) return;
    if (shuffle) { player.playList(ids, undefined, { shuffle: true }); toast(t('shuffle')); return; }
    player.playList(ids, ids[0]);
    const s = lib.byId[ids[0]];
    if (s) toast(t('now_playing') + ': ' + s.title);
  };

  function run(a) {
    if (!a) return;
    switch (a.action) {
      case 'library': go('Music'); return;
      case 'settings': go('Settings'); return;
      case 'reports': go('Reports', a.period ? { linkPeriod: a.period, linkAt: Date.now() } : undefined); return;
      case 'top': go('Top', a.period ? { linkPeriod: a.period, linkAt: Date.now() } : undefined); return;
      case 'sleep': {
        player.setSleep(a.min === 0 ? null : a.min);
        toast(a.min === 0 ? t('sleep_off') : a.min === 'end' ? t('sleep_end') : t('sleep_left', { n: a.min }));
        return;
      }
      case 'snippets': {
        if (!lib.songs.length) { go('Music'); return; }
        if (!pro.requireRoom('snippetsDay', player.snipUsed)) return;
        let ids;
        if (hasFilter(a)) ids = pickSongs(a, lib.songs, { playCount: lib.playCount, uiLangName }).map(s => s.id);
        else {
          // без условий — сначала песни, которые ещё ни разу не слушали
          const fresh = lib.songs.filter(s => !lib.lastPlayed[s.id]).map(s => s.id);
          ids = fresh.length ? fresh : lib.songs.map(s => s.id);
        }
        if (!ids.length) { toast(t('nothing_found') + ': ' + searchText(a)); showSearch(a); return; }
        player.playList(ids, undefined, { shuffle: true, snippets: true });
        toast(t('snip_started'));
        return;
      }
      case 'playlist': {
        const n = norm(a.name || '');
        const pl = n ? (lib.playlists.find(p => norm(p.name) === n) || lib.playlists.find(p => norm(p.name).includes(n))) : null;
        if (!pl) { if (n) toast(t('nothing_found') + ': ' + a.name); go('Music'); return; }
        const ids = pl.ids.filter(id => lib.byId[id]);
        if (!ids.length) { go('Music', { linkSearch: { q: '', filter: 'pl:' + pl.id }, linkAt: Date.now() }); return; }
        start(ids, !!a.shuffle);
        return;
      }
      case 'player': if (player.queue.length) openPlayer(); else go('Music'); return;
      case 'search': showSearch(a); return;
      case 'pause': if (playingRef.current) player.toggle(); return;
      case 'resume': if (!playingRef.current) player.toggle(); return;
      case 'toggle': player.toggle(); return;
      case 'next': player.next(); return;
      case 'prev': player.prev(); return;
      case 'stop': player.stop(); return;
      case 'mix': {
        if (!lib.songs.length) { go('Music'); return; }
        const top = [...lib.songs].sort((x, y) => (lib.playCount[y.id] || 0) - (lib.playCount[x.id] || 0) || Number(!!y.fav) - Number(!!x.fav));
        const pool = top.slice(0, Math.min(5, top.length));
        const seed = (lib.playCount[top[0].id] || top[0].fav) ? pool[Math.floor(Math.random() * pool.length)] : lib.songs[Math.floor(Math.random() * lib.songs.length)];
        player.playList(radioQueue(seed, lib.songs, lib.recIndex, 50));
        toast(t('for_you'));
        return;
      }
      case 'radio': {
        let seed = null;
        if (hasFilter(a)) seed = pickSongs(a, lib.songs, { playCount: lib.playCount, uiLangName })[0];
        else seed = lib.byId[player.currentId];
        if (!seed) { toast(t('nothing_found') + (searchText(a) ? ': ' + searchText(a) : '')); if (hasFilter(a)) showSearch(a); return; }
        player.playList(radioQueue(seed, lib.songs, lib.recIndex, 40));
        toast(t('radio_started', { t: seed.title }));
        return;
      }
      case 'play': {
        if (!lib.songs.length) { go('Music'); return; }
        if (!hasFilter(a)) {
          // «Включи музыку»: продолжить начатое, иначе — всю библиотеку (новые первыми).
          if (!a.shuffle && player.queue.length) { if (!playingRef.current) player.toggle(); return; }
          const all = [...lib.songs].sort((x, y) => (y.addedAt || 0) - (x.addedAt || 0)).map(s => s.id);
          start(all, !!a.shuffle);
          return;
        }
        const found = pickSongs(a, lib.songs, { playCount: lib.playCount, uiLangName });
        if (!found.length) { toast(t('nothing_found') + ': ' + searchText(a)); showSearch(a); return; }
        // Одна песня — она, а за ней похожие (как «радио»), чтобы музыка не кончилась.
        const ids = found.length === 1 && !a.shuffle
          ? radioQueue(found[0], lib.songs, lib.recIndex, 40)
          : found.map(s => s.id);
        start(ids, !!a.shuffle);
        return;
      }
      default:
    }
  }

  return null;
}
