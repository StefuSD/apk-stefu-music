import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator, ToastAndroid, Image, Switch } from 'react-native';
import HeaderBg from '../components/HeaderBg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PromptDialog from '../components/PromptDialog';
import PlaylistOrder from '../components/PlaylistOrder';
import BulkEditor from '../components/BulkEditor';
import { usePro } from '../pro/ProContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { useUI } from '../context/UIContext';
import { fmtTime, fmtListen } from '../utils/format';
import Cover from '../components/Cover';
import SongRow from '../components/SongRow';
import { FlashList } from '@shopify/flash-list';
import { radioQueue } from '../utils/recommend';
import { langName } from '../utils/languages';
import ActionSheet from '../components/ActionSheet';
import { shareSong } from '../utils/shareSong';
import {
  PlusIcon, SearchIcon, HeartIcon, MoreIcon, PlayIcon, ShuffleIcon, CloseIcon, MusicIcon,
  ShareIcon, PlayNextIcon, EditIcon, TrashIcon, SparkleIcon, BoltIcon, SortIcon, LanguageIcon, VideoIcon, ScissorsIcon, AppGlyphIcon,
  PlaylistIcon, CheckIcon, DragIcon, SelectIcon, LyricsIcon,
} from '../components/icons';

const K_VIEW = 'sm_libview';   // выбранные сортировка и фильтр — между запусками
const SORTS = ['recent', 'last', 'plays', 'title', 'artist'];

export default function LibraryScreen({ route }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');   // all | fav | tag:<name>
  const [sort, setSort] = useState('recent');
  // Тумблер в шапке: три строки над списком (чипы, «Играть все», «Для вас»/«Сниппеты») можно спрятать —
  // больше места песням. Запоминается.
  const [showBar, setShowBar] = useState(true);
  useEffect(() => { AsyncStorage.getItem('sm_bar').then(v => { if (v === '0') setShowBar(false); }).catch(() => {}); }, []);
  const toggleBar = v => { setShowBar(v); AsyncStorage.setItem('sm_bar', v ? '1' : '0').catch(() => {}); };
  const pro = usePro();
  const [viewLoaded, setViewLoaded] = useState(false);
  const [sel, setSel] = useState(null);           // null — обычный режим; массив id — выбор нескольких
  const [plPick, setPlPick] = useState(null);     // { ids } — выбрать плейлист, куда добавить
  const [prompt, setPrompt] = useState(null);     // { title, value, onDone }
  const [orderPl, setOrderPl] = useState(null);   // плейлист, у которого меняем порядок
  const [bulk, setBulk] = useState(null);         // id песен для массовой правки

  // Сортировка и фильтр запоминаются (плейлист или тег — тоже, пока он существует).
  useEffect(() => {
    AsyncStorage.getItem(K_VIEW).then(raw => {
      if (!raw) return;
      try {
        const v = JSON.parse(raw);
        if (SORTS.includes(v.sort)) setSort(v.sort);
        if (typeof v.filter === 'string') setFilter(v.filter);
      } catch (e) { /* */ }
    }).catch(() => {}).finally(() => setViewLoaded(true));
  }, []);
  useEffect(() => {
    if (viewLoaded) AsyncStorage.setItem(K_VIEW, JSON.stringify({ sort, filter })).catch(() => {});
  }, [sort, filter, viewLoaded]);

  const plId = filter.startsWith('pl:') ? filter.slice(3) : null;
  const curPl = plId ? lib.playlists.find(p => p.id === plId) : null;
  // Фильтр указывает на удалённый плейлист, тег или язык — возвращаемся ко «Всем».
  useEffect(() => {
    if (!lib.loaded || !viewLoaded) return;
    if ((plId && !curPl) || (filter.startsWith('tag:') && !lib.allTags.includes(filter.slice(4)))
      || (filter.startsWith('lang:') && !lib.allLangs.includes(filter.slice(5)))) setFilter('all');
  }, [lib.loaded, viewLoaded, plId, curPl, lib.allTags, lib.allLangs]);

  // Ссылка com.stefu.music://search?q=… (src/links/LinkHandler.js): поиск и фильтр — один раз на ссылку.
  const linkAt = route && route.params && route.params.linkAt;
  useEffect(() => {
    const ls = linkAt && route.params.linkSearch;
    if (!ls) return;
    setQ(typeof ls.q === 'string' ? ls.q : '');
    setFilter(typeof ls.filter === 'string' ? ls.filter : 'all');
  }, [linkAt]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = lib.songs;
    if (curPl) arr = curPl.ids.map(id => lib.byId[id]).filter(Boolean);
    else if (filter === 'fav') arr = arr.filter(s => s.fav);
    else if (filter === 'has:lyrics') arr = arr.filter(s => s.lyrics);
    else if (filter === 'has:video') arr = arr.filter(s => s.videoUrl);
    else if (filter.startsWith('tag:')) { const tg = filter.slice(4); arr = arr.filter(s => (s.tags || []).includes(tg)); }
    else if (filter.startsWith('lang:')) { const lg = filter.slice(5); arr = arr.filter(s => (s.langs || []).includes(lg)); }
    if (needle) {
      arr = arr.filter(s => [s.title, s.artist, s.album, s.genre, ...(s.tags || []).map(x => '#' + x + ' ' + x), ...(s.langs || []).map(l => langName(l, lang))]
        .some(v => (v || '').toLowerCase().includes(needle)));
    }
    const cmp = {
      recent: (a, b) => b.addedAt - a.addedAt,
      last: (a, b) => (lib.lastPlayed[b.id] || 0) - (lib.lastPlayed[a.id] || 0),
      plays: (a, b) => (lib.playCount[b.id] || 0) - (lib.playCount[a.id] || 0) || b.addedAt - a.addedAt,
      title: (a, b) => a.title.localeCompare(b.title),
      artist: (a, b) => (a.artist || '￿').localeCompare(b.artist || '￿') || a.title.localeCompare(b.title),
    }[sort];
    // У плейлиста свой порядок — сортировка его не трогает.
    return curPl ? arr : [...arr].sort(cmp);
  }, [lib.songs, lib.byId, lib.playCount, lib.lastPlayed, q, filter, sort, lang, curPl]);

  const ids = useMemo(() => list.map(s => s.id), [list]);
  // Сколько звучит песня с учётом обрезки.
  const playLen = (s) => (s.duration ? Math.max(0, (s.trimEnd || s.duration) - (s.trimStart || 0)) : 0);
  const totalSec = useMemo(() => list.reduce((a, s) => a + playLen(s), 0), [list]);

  const runImport = async (folder) => {
    try {
      const r = folder ? await lib.importFolder() : await lib.importMusic();
      if (r && r.none) { Alert.alert('', t('folder_empty')); return; }
      if (r) {
        let msg = t('imported', { n: r.added });
        if (r.dup) msg += '\n' + t('skipped_dup', { n: r.dup });
        if (r.updated) msg += '\n' + t('dup_updated', { n: r.updated });
        ToastAndroid.show(msg, ToastAndroid.LONG);
      }
    } catch (e) { Alert.alert('', String(e?.message || e)); }
  };
  const doImport = () => Alert.alert(t('add_how'), '', [
    { text: t('cancel'), style: 'cancel' },
    { text: t('add_folder'), onPress: () => runImport(true) },
    { text: t('add_files'), onPress: () => runImport(false) },
  ], { cancelable: true });

  // Микс: радио от песни, которую вы слушаете чаще всего (или любимой, или случайной).
  const mixForYou = () => {
    if (!lib.songs.length) return;
    const top = [...lib.songs].sort((a, b) => (lib.playCount[b.id] || 0) - (lib.playCount[a.id] || 0) || Number(!!b.fav) - Number(!!a.fav));
    const pool = top.slice(0, Math.min(5, top.length));
    const seed = (lib.playCount[top[0].id] || top[0].fav) ? pool[Math.floor(Math.random() * pool.length)] : lib.songs[Math.floor(Math.random() * lib.songs.length)];
    player.playList(radioQueue(seed, lib.songs, lib.recIndex, 50));
    ToastAndroid.show(t('for_you'), ToastAndroid.SHORT);
  };

  // ---- Плейлисты и выбор нескольких песен.
  const newPlaylist = (ids = []) => setPrompt({
    title: t('pl_new'), value: '',
    onDone: name => {
      const pl = lib.createPlaylist(name, ids);
      ToastAndroid.show(ids.length ? t('pl_added', { n: ids.length, p: pl.name }) : t('pl_created', { p: pl.name }), ToastAndroid.SHORT);
      if (!ids.length) setFilter('pl:' + pl.id);
      setSel(null);
    },
  });
  const addTo = (pl, ids) => {
    const n = lib.addToPlaylist(pl.id, ids);
    ToastAndroid.show(n ? t('pl_added', { n, p: pl.name }) : t('pl_already', { p: pl.name }), ToastAndroid.SHORT);
    setSel(null);
  };
  const pickItems = plPick ? [
    ...lib.playlists.map(pl => ({ label: `${pl.name} · ${pl.ids.length}`, Icon: PlaylistIcon, onPress: () => addTo(pl, plPick.ids) })),
    { label: t('pl_new'), Icon: PlusIcon, onPress: () => newPlaylist(plPick.ids) },
  ] : [];
  const toggleSel = (id) => setSel(cur => {
    const a = cur || [];
    const next = a.includes(id) ? a.filter(x => x !== id) : [...a, id];
    return next.length ? next : null;
  });
  const delSelected = () => {
    const ids = sel || [];
    Alert.alert('', t('delete_many_q', { n: ids.length }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { lib.deleteSongs(ids); setSel(null); } },
    ]);
  };
  const plMenu = curPl ? [
    { label: t('pl_order'), Icon: DragIcon, onPress: () => setOrderPl(curPl) },
    { label: t('pl_rename'), Icon: EditIcon, onPress: () => setPrompt({ title: t('pl_rename'), value: curPl.name, onDone: name => lib.renamePlaylist(curPl.id, name) }) },
    { label: t('pl_delete'), Icon: TrashIcon, danger: true, onPress: () => Alert.alert('', t('pl_delete_q', { p: curPl.name }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => { lib.deletePlaylist(curPl.id); setFilter('all'); } },
    ]) },
  ] : [];
  const [plMenuOpen, setPlMenuOpen] = useState(false);

  const [menu, setMenu] = useState(null);
  const more = (s) => setMenu(s);
  const menuItems = menu ? [
    { label: t('pl_add'), Icon: PlaylistIcon, onPress: () => setPlPick({ ids: [menu.id] }) },
    ...(curPl ? [{ label: t('pl_remove'), Icon: CloseIcon, onPress: () => lib.removeFromPlaylist(curPl.id, menu.id) }] : []),
    { label: t('share'), Icon: ShareIcon, onPress: () => shareSong(menu, { songUri: lib.songUri(menu), coverUri: lib.coverUri(menu) }).catch(e => Alert.alert('', String(e?.message || e))) },
    { label: t('queue_next'), Icon: PlayNextIcon, onPress: () => { player.playNext(menu.id); ToastAndroid.show(t('queued') + ': ' + menu.title, ToastAndroid.SHORT); } },
    { label: t('edit_song'), Icon: EditIcon, onPress: () => ui.openEditor(menu) },
    { label: t('delete'), Icon: TrashIcon, danger: true, onPress: () => { const s = menu; Alert.alert('', t('delete_q', { t: s.title }), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: () => lib.deleteSongs([s.id]) },
    ]); } },
  ] : [];

  const tagChips = lib.allTags.map(tg => ({ k: 'tag:' + tg, label: tg }));
  const langChips = lib.allLangs.map(l => ({ k: 'lang:' + l, label: langName(l, lang), Icon: LanguageIcon, iconColor: colors.textMuted }));
  const filterChip = (c) => {
    const on = filter === c.k;
    const fg = on ? colors.onInk : colors.text;
    const Ico = c.Icon;
    return (
      <Pressable key={c.k} onPress={() => setFilter(on && c.k !== 'all' ? 'all' : c.k)}
        style={[st.chip, on ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
        {Ico ? <Ico color={on ? fg : colors.textMuted} size={15} style={{ marginRight: 5 }} /> : null}
        <Text style={{ color: fg, fontWeight: '500', fontSize: 13 }}>{c.label}</Text>
      </Pressable>
    );
  };
  // Сортировка — тоже кнопки, но другого вида: светлая заливка вместо сплошной.
  const sortChip = (k, i) => {
    const on = sort === k;
    return (
      <Pressable key={'s' + k} onPress={() => setSort(k)}
        style={[st.chip, on ? { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft } : { borderColor: 'transparent', backgroundColor: 'transparent' }]}>
        {i === 0 ? <SortIcon color={on ? colors.accent : colors.textMuted} size={15} style={{ marginRight: 5 }} /> : null}
        <Text style={{ color: on ? colors.accent : colors.textMuted, fontWeight: on ? '600' : '500', fontSize: 13 }}>{t('sort_' + k)}</Text>
      </Pressable>
    );
  };

  // Нажатия по строке — постоянные функции (через ref), чтобы строки-memo не перерисовывались зря.
  const rowAct = useRef({});
  rowAct.current = {
    press: s => (sel ? toggleSel(s.id) : player.currentId === s.id ? player.toggle() : player.playList(ids, s.id)),
    // Долгое нажатие — выбор нескольких песен; в режиме выбора тап отмечает песню.
    long: s => toggleSel(s.id),
    more: s => more(s),
  };
  const onRowPress = useCallback(s => rowAct.current.press(s), []);
  const onRowLong = useCallback(s => rowAct.current.long(s), []);
  const onRowMore = useCallback(s => rowAct.current.more(s), []);
  const renderItem = useCallback(({ item: s }) => (
    <SongRow song={s} plays={lib.playCount[s.id] || 0} active={player.currentId === s.id}
      picked={!!sel && sel.includes(s.id)} selMode={!!sel} colors={colors} lang={lang} t={t}
      onPress={onRowPress} onLongPress={onRowLong} onMore={onRowMore} />
  ), [lib.playCount, player.currentId, sel, colors, lang, t, onRowPress, onRowLong, onRowMore]);

  // Только припевы — и из кнопки в шапке, и из строки «Сниппеты» над списком.
  const playSnippets = () => {
    if (ids.length && pro.requireRoom('snippetsDay', player.snipUsed)) {
      player.playList(ids, ids[0], { snippets: true });
      ToastAndroid.show(t('snip_started'), ToastAndroid.SHORT);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 10 }]}>
        <HeaderBg />
        {sel ? (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 38 }}>
              <Pressable onPress={() => setSel(null)} hitSlop={10}><CloseIcon color={colors.headerText} size={26} /></Pressable>
              <Text style={[st.title, { color: colors.headerText, marginLeft: 12 }]}>{t('sel_n', { n: sel.length })}</Text>
              <Pressable onPress={() => setSel(sel.length === ids.length ? null : [...ids])} style={[st.addBtn, { backgroundColor: colors.headerBtn }]}>
                <SelectIcon color={colors.headerText} size={18} />
                <Text style={{ color: colors.headerText, fontWeight: '700', marginLeft: 6 }}>{t(sel.length === ids.length ? 'sel_none' : 'sel_all')}</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 12 }}>
              {[
                { k: 'pl_add', Icon: PlaylistIcon, on: () => setPlPick({ ids: [...sel] }) },
                { k: 'queue_next', Icon: PlayNextIcon, on: () => { [...sel].reverse().forEach(id => player.playNext(id)); ToastAndroid.show(t('queued'), ToastAndroid.SHORT); setSel(null); } },
                ...(curPl ? [{ k: 'pl_remove', Icon: CloseIcon, on: () => { sel.forEach(id => lib.removeFromPlaylist(curPl.id, id)); setSel(null); } }] : []),
              ].map(b => (
                <Pressable key={b.k} onPress={b.on} style={[st.addBtn, { backgroundColor: colors.headerBtn }]}>
                  <b.Icon color={colors.headerText} size={18} />
                  <Text style={{ color: colors.headerText, fontWeight: '700', marginLeft: 6 }}>{t(b.k)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : (<>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <AppGlyphIcon color={colors.headerText} size={30} />
          <Text style={[st.title, { color: colors.headerText, marginLeft: 10 }]}>{t('app_title')}</Text>
          {lib.songs.length > 0 ? (
            <Switch value={showBar} onValueChange={toggleBar} style={{ marginRight: 6 }}
              trackColor={{ false: colors.headerBtn, true: colors.headerText + '88' }} thumbColor={colors.headerText} />
          ) : null}
          {/* Добавить — просто плюс; пока идёт добавление — счётчик рядом с крутилкой. */}
          {lib.progress ? (
            <View style={[st.addBtn, { backgroundColor: colors.headerBtn }]}>
              <ActivityIndicator color={colors.headerText} size="small" />
              <Text style={{ color: colors.headerText, fontWeight: '700', marginLeft: 4 }}>{t('importing', lib.progress)}</Text>
            </View>
          ) : (
            <Pressable onPress={doImport} hitSlop={6} style={[st.iconBtn, { backgroundColor: colors.headerBtn, marginLeft: 0 }]}>
              <PlusIcon color={colors.headerText} size={24} />
            </Pressable>
          )}
          {lib.songs.length > 0 ? (
            <Pressable onPress={playSnippets} hitSlop={6} style={[st.iconBtn, { backgroundColor: colors.headerBtn }]}>
              <BoltIcon color={colors.headerText} size={22} />
            </Pressable>
          ) : null}
        </View>
        {lib.songs.length > 0 && (
          <View style={[st.search, { backgroundColor: colors.headerBtn }]}>
            <SearchIcon color={colors.headerText} size={20} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={colors.headerText + 'aa'}
              style={{ flex: 1, color: colors.headerText, fontSize: 15, fontWeight: '700', paddingVertical: 8, marginLeft: 8 }} />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={10}><CloseIcon color={colors.headerText} size={18} /></Pressable> : null}
          </View>
        )}
        </>)}
      </View>

      {lib.loaded && lib.songs.length === 0 ? (
        <View style={st.empty}>
          <View style={[st.emptyIcon, { backgroundColor: colors.accentSoft }]}><MusicIcon color={colors.accent} size={56} /></View>
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 18, textAlign: 'center' }}>{t('empty_title')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 21 }}>{t('empty_text')}</Text>
          <Pressable onPress={doImport} style={[st.bigBtn, { backgroundColor: colors.accent }]}>
            <PlusIcon color={colors.onAccent} size={22} />
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16, marginLeft: 6 }}>{t('add_music')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          key={showBar ? 'bar' : 'nobar'}
          data={list}
          keyExtractor={s => s.id}
          renderItem={renderItem}
          extraData={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: sel ? 160 : 24 }}
          ListHeaderComponent={!showBar ? null :
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
                {filterChip({ k: 'all', label: t('all') })}
                {filterChip({ k: 'fav', label: t('favorites'), Icon: HeartIcon })}
                {lib.songs.some(x => x.lyrics) ? filterChip({ k: 'has:lyrics', label: t('flt_lyrics'), Icon: LyricsIcon }) : null}
                {lib.songs.some(x => x.videoUrl) ? filterChip({ k: 'has:video', label: t('flt_video'), Icon: VideoIcon }) : null}
                {lib.playlists.map(pl => filterChip({ k: 'pl:' + pl.id, label: pl.name, Icon: PlaylistIcon }))}
                <Pressable onPress={() => newPlaylist()} style={[st.chip, { borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
                  <PlusIcon color={colors.textMuted} size={15} style={{ marginRight: 3 }} />
                  <Text style={{ color: colors.textMuted, fontWeight: '500', fontSize: 13 }}>{t('pl_short')}</Text>
                </Pressable>
                <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
                {curPl ? (
                  <Pressable onPress={() => setPlMenuOpen(true)} style={[st.chip, { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft }]}>
                    <MoreIcon color={colors.accent} size={15} style={{ marginRight: 3 }} />
                    <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>{t('pl_manage')}</Text>
                  </Pressable>
                ) : SORTS.map(sortChip)}
                {tagChips.length > 0 && <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />}
                {tagChips.map(filterChip)}
                {langChips.length > 0 && <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />}
                {langChips.map(filterChip)}
              </ScrollView>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, gap: 10 }}>
                <Pressable onPress={() => player.playList(ids, ids[0])} disabled={!ids.length} style={[st.act, { backgroundColor: colors.ink }]}>
                  <PlayIcon color={colors.onInk} size={20} />
                  <Text style={{ color: colors.onInk, fontWeight: '600', marginLeft: 4 }}>{t('play_all')}</Text>
                </Pressable>
                <Pressable onPress={() => player.playList(ids, null, { shuffle: true })} disabled={!ids.length}
                  style={[st.act, { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textMuted }]}>
                  <ShuffleIcon color={colors.text} size={20} />
                  <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 6 }}>{t('shuffle')}</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 8 }}>
                <Pressable onPress={mixForYou} style={[st.act, { backgroundColor: colors.accentSoft }]}>
                  <SparkleIcon color={colors.accent} size={18} />
                  <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 6 }}>{t('for_you')}</Text>
                </Pressable>
                {/* Только припевы: быстро понять, что нравится, не слушая песни целиком. */}
                <Pressable onPress={playSnippets}
                  style={[st.act, { backgroundColor: colors.accentSoft, marginLeft: 8 }]}>
                  <BoltIcon color={colors.accent} size={18} />
                  <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 6 }}>{t('snip_short')}</Text>
                  {player.snipUsed >= pro.limit('snippetsDay') ? <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 10, marginLeft: 5 }}>PRO</Text> : null}
                </Pressable>
                <Text style={{ color: colors.textMuted, marginLeft: 'auto', textAlign: 'right' }}>
                  {t('total_len', { n: list.length, d: fmtListen(totalSec, t) })}
                  {lib.scan ? '\n' + t('scanning', lib.scan) : ''}
                </Text>
              </View>
            </View>
          }
          ListEmptyComponent={lib.loaded ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 30 }}>{t('nothing_found')}</Text> : null}
        />
      )}
      <ActionSheet visible={!!menu} title={menu?.title} subtitle={menu ? (menu.artist || t('unknown_artist')) : ''}
        lead={menu ? <Cover song={menu} size={46} /> : null} items={menuItems} onClose={() => setMenu(null)} />
      <ActionSheet visible={!!plPick} title={t('pl_add')} subtitle={plPick && plPick.ids.length > 1 ? t('sel_n', { n: plPick.ids.length }) : ''}
        items={pickItems} onClose={() => setPlPick(null)} />
      <ActionSheet visible={plMenuOpen} title={curPl ? curPl.name : ''} subtitle={curPl ? t('songs_count', { n: curPl.ids.length }) : ''}
        items={plMenu} onClose={() => setPlMenuOpen(false)} />
      <PromptDialog visible={!!prompt} title={prompt ? prompt.title : ''} value={prompt ? prompt.value : ''} placeholder={t('pl_name')}
        onDone={v => prompt && prompt.onDone(v)} onClose={() => setPrompt(null)} />
      <PlaylistOrder playlist={orderPl} onClose={() => setOrderPl(null)} />
      {/* Выбор песен: «Изменить» и «Удалить» — плавающие кнопки справа внизу (над мини-плеером). */}
      {sel ? (
        <View style={st.fabs} pointerEvents="box-none">
          <Pressable onPress={() => sel.length && setBulk([...sel])} disabled={!sel.length} accessibilityLabel={t('bulk_edit')}
            style={({ pressed }) => [st.fab, { backgroundColor: colors.ink, opacity: !sel.length ? 0.4 : pressed ? 0.8 : 1 }]}>
            <EditIcon color={colors.onInk} size={24} />
          </Pressable>
          <Pressable onPress={() => sel.length && delSelected()} disabled={!sel.length} accessibilityLabel={t('delete')}
            style={({ pressed }) => [st.fab, { backgroundColor: colors.danger, opacity: !sel.length ? 0.4 : pressed ? 0.8 : 1 }]}>
            <TrashIcon color="#ffffff" size={24} />
          </Pressable>
        </View>
      ) : null}
      <BulkEditor ids={bulk} onClose={() => setBulk(null)} onDone={() => setSel(null)} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '600', flex: 1, letterSpacing: 0.3, marginLeft: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  fabs: { position: 'absolute', right: 16, bottom: 16, gap: 12, alignItems: 'center' },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  act: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  bigBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 28 },
});
