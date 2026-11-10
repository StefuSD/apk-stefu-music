import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, Alert, ScrollView, ActivityIndicator, ToastAndroid, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { useUI } from '../context/UIContext';
import { fmtTime, fmtListen } from '../utils/format';
import Cover from '../components/Cover';
import { radioQueue } from '../utils/recommend';
import { langName } from '../utils/languages';
import ActionSheet from '../components/ActionSheet';
import { shareSong } from '../utils/shareSong';
import {
  PlusIcon, SearchIcon, HeartIcon, MoreIcon, PlayIcon, ShuffleIcon, CloseIcon, MusicIcon,
  ShareIcon, PlayNextIcon, EditIcon, TrashIcon, SparkleIcon, SortIcon, LanguageIcon, VideoIcon, ScissorsIcon,
} from '../components/icons';
import Equalizer from '../components/Equalizer';

const SORTS = ['recent', 'last', 'plays', 'title', 'artist'];

/** Живая часть обложки играющей песни: эквалайзер или треугольник на паузе. */
function LiveMark({ size }) {
  const { playing } = usePlayerStatus();
  return playing
    ? <Equalizer playing color="#ffffff" size={size * 0.4} bars={4} />
    : <PlayIcon color="#ffffff" size={size * 0.56} style={{ marginLeft: size * 0.04 }} />;
}

/**
 * Круглая обложка с кнопкой Play поверх (как в списках аудио мессенджеров).
 * Без картинки — фиолетовый круг. Статус плеера слушает только строка
 * играющей песни — остальные не перерисовываются каждые 250 мс.
 */
function RowCover({ song, current, size = 54 }) {
  const { colors } = useTheme();
  const { coverUri } = useLibrary();
  const uri = coverUri(song);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', width: size, height: size }} /> : null}
      {uri ? <View style={{ position: 'absolute', width: size, height: size, backgroundColor: 'rgba(0,0,0,0.32)' }} /> : null}
      {current ? <LiveMark size={size} /> : <PlayIcon color="#ffffff" size={size * 0.56} style={{ marginLeft: size * 0.04 }} />}
    </View>
  );
}

function LiveTime({ len, color }) {
  const { currentTime } = usePlayerStatus();
  return <Text style={{ color, fontSize: 12 }}>{fmtTime(currentTime)} / {len ? fmtTime(len) : '–:––'}</Text>;
}

/** «0:42 / 3:58»: у играющей песни идёт время; у обрезанной — длина куска и ножницы. */
function RowTime({ song, current, color }) {
  const trimmed = !!(song.trimStart || song.trimEnd);
  const len = song.duration ? Math.max(0, (song.trimEnd || song.duration) - (song.trimStart || 0)) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {current ? <LiveTime len={song.duration} color={color} />
        : <Text style={{ color, fontSize: 12 }}>{len ? fmtTime(len) : '–:––'}</Text>}
      {trimmed ? <ScissorsIcon color={color} size={12} style={{ marginLeft: 4 }} /> : null}
    </View>
  );
}

export default function LibraryScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const player = usePlayer();
  const ui = useUI();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');   // all | fav | tag:<name>
  const [sort, setSort] = useState('recent');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let arr = lib.songs;
    if (filter === 'fav') arr = arr.filter(s => s.fav);
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
    return [...arr].sort(cmp);
  }, [lib.songs, lib.playCount, lib.lastPlayed, q, filter, sort, lang]);

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

  const [menu, setMenu] = useState(null);
  const more = (s) => setMenu(s);
  const menuItems = menu ? [
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

  const renderItem = ({ item: s }) => {
    const plays = lib.playCount[s.id] || 0;
    const active = player.currentId === s.id;
    return (
      <Pressable onPress={() => (active ? player.toggle() : player.playList(ids, s.id))} onLongPress={() => ui.openEditor(s)}
        style={({ pressed }) => [st.card, {
          backgroundColor: pressed ? colors.accentSoft : colors.bgCard,
          borderColor: active ? colors.accent + '66' : colors.border,
        }]}>
        <RowCover song={s} current={active} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <Text style={{ color: active ? colors.accent : colors.text, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>{s.title}</Text>
            {s.fav && <HeartIcon color={colors.textMuted} size={14} style={{ marginLeft: 6, marginTop: 3 }} />}
            <Pressable onPress={() => more(s)} hitSlop={12} style={{ marginLeft: 4, marginRight: -6, marginTop: -2, paddingHorizontal: 4 }}>
              <MoreIcon color={colors.textMuted} size={20} />
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
            <Text style={{ color: colors.textMuted, fontSize: 14, flexShrink: 1 }} numberOfLines={1}>{s.artist || t('unknown_artist')}</Text>
            {s.langs?.length > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginLeft: 8, letterSpacing: 0.5 }}>
                {s.langs.map(l => (l.length <= 4 ? l.toUpperCase() : l)).join(' · ')}
              </Text>
            )}
            {s.videoUrl ? <VideoIcon color={colors.textMuted} size={14} style={{ marginLeft: 6 }} /> : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
            <RowTime song={s} current={active} color={colors.textMuted} />
            {s.tags?.length > 0 && (
              <Text style={{ fontSize: 12, marginLeft: 10, flex: 1 }} numberOfLines={1}>
                <Text style={{ color: tagColor(colors), fontWeight: '500' }}>{s.tags.join(' · ')}</Text>
              </Text>
            )}
            {!(s.tags?.length > 0) && <View style={{ flex: 1 }} />}
            <PlayIcon color={colors.textMuted} size={14} />
            <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 1 }}>{plays}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[st.title, { color: colors.headerText }]}>{t('app_title')}</Text>
          <Pressable onPress={doImport} disabled={!!lib.progress} style={[st.addBtn, { backgroundColor: colors.headerBtn }]}>
            {lib.progress ? <ActivityIndicator color={colors.headerText} size="small" /> : <PlusIcon color={colors.headerText} size={22} />}
            <Text style={{ color: colors.headerText, fontWeight: '700', marginLeft: 4 }}>
              {lib.progress ? t('importing', lib.progress) : t('add_music')}
            </Text>
          </Pressable>
        </View>
        {lib.songs.length > 0 && (
          <View style={[st.search, { backgroundColor: colors.headerBtn }]}>
            <SearchIcon color={colors.headerText} size={20} />
            <TextInput value={q} onChangeText={setQ} placeholder={t('search')} placeholderTextColor={colors.headerText + 'aa'}
              style={{ flex: 1, color: colors.headerText, fontSize: 15, paddingVertical: 8, marginLeft: 8 }} />
            {q ? <Pressable onPress={() => setQ('')} hitSlop={10}><CloseIcon color={colors.headerText} size={18} /></Pressable> : null}
          </View>
        )}
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
        <FlatList
          data={list}
          keyExtractor={s => s.id}
          renderItem={renderItem}
          initialNumToRender={14}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 12, gap: 8 }}>
                {filterChip({ k: 'all', label: t('all') })}
                {filterChip({ k: 'fav', label: t('favorites'), Icon: HeartIcon })}
                <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
                {SORTS.map(sortChip)}
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
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingBottom: 12 },
  title: { fontSize: 20, fontWeight: '600', flex: 1, letterSpacing: 0.3, marginLeft: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  search: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 12, marginTop: 12 },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 3, paddingLeft: 10, paddingRight: 12, paddingVertical: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  act: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyIcon: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  bigBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 24, paddingHorizontal: 22, paddingVertical: 14, borderRadius: 28 },
});
