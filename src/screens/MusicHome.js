// Главная «Музыки» — вкладка «Для вас»: быстрые действия, «Новые», «Рекомендуемое»,
// «Часто слушаете», «Избранное»; и вкладки «Плейлисты» и «Исполнители».
// Список песен со всеми фильтрами — вкладка «Песни» (LibraryScreen).
import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import Cover from '../components/Cover';
import { artistsOf } from '../utils/artists';
import { radioQueue } from '../utils/recommend';
import { ShuffleIcon, PlayIcon, SparkleIcon, BoltIcon, PlaylistIcon, PlusIcon, ChevRightIcon, HeadphonesIcon } from '../components/icons';

const N = 12;          // песен в карусели
const W = Dimensions.get('window').width;

/** Вкладки над содержимым: «таблетки», выбранная — заливкой. */
export function HomeTabs({ tab, onTab }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const tabs = [['home', t('tab_home')], ['songs', t('tab_songs')], ['playlists', t('tab_playlists')], ['artists', t('tab_artists')]];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12, gap: 8 }}>
      {tabs.map(([k, l]) => {
        const on = tab === k;
        return (
          <Pressable key={k} onPress={() => onTab(k)}
            style={[st.tab, on ? { backgroundColor: colors.ink } : { backgroundColor: colors.bgCard, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
            <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: on ? '800' : '600', fontSize: 15 }}>{l}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Вкладка «Для вас». actions: { shuffle, playAll, mix, snippets }; onMore(kind) — «все» у раздела. */
export function HomeView({ actions, onMore, snipPro }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  const player = usePlayer();
  const [recSeed, setRecSeed] = useState(0);

  const fresh = useMemo(() => [...lib.songs].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, N), [lib.songs]);
  const top = useMemo(() => lib.songs.filter(s => lib.playCount[s.id])
    .sort((a, b) => lib.playCount[b.id] - lib.playCount[a.id]).slice(0, N), [lib.songs, lib.playCount]);
  const favs = useMemo(() => lib.songs.filter(s => s.fav).slice(0, N), [lib.songs]);
  // рекомендации: радио от одной из любимых или самых слушаемых песен (кнопка «Перемешать» берёт другую)
  const rec = useMemo(() => {
    if (!lib.songs.length) return [];
    const pool = (top.length ? top : favs.length ? favs : lib.songs).slice(0, 5);
    const seed = pool[(recSeed + Math.floor(Math.random() * pool.length)) % pool.length];
    return radioQueue(seed, lib.songs, lib.recIndex, 13).map(id => lib.byId[id]).filter(Boolean).filter(s => s.id !== seed.id).slice(0, N);
  }, [lib.songs, lib.recIndex, recSeed, top.length > 0]);

  const play = (list, id) => player.playList(list.map(s => s.id), id);
  const Section = ({ title, more, right }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginTop: 22, marginBottom: 10 }}>
      <Pressable onPress={more} disabled={!more} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        {more ? <ChevRightIcon color={colors.textMuted} size={24} /> : null}
      </Pressable>
      {right}
    </View>
  );
  const Carousel = ({ list }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
      {list.map(s => (
        <Pressable key={s.id} onPress={() => play(list, s.id)} style={{ width: 140 }}>
          <View>
            <Cover song={s} size={140} radius={14} />
            <View style={[st.playDot, { backgroundColor: 'rgba(0,0,0,0.45)' }]}><PlayIcon color="#fff" size={18} /></View>
          </View>
          <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginTop: 6 }}>{s.title}</Text>
          <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>{s.artist || t('unknown_artist')}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
  // «Рекомендуемое»: две строки, листается вбок колонками
  const cols = [];
  for (let i = 0; i < rec.length; i += 2) cols.push(rec.slice(i, i + 2));
  const rowW = Math.round(W * 0.78);

  const tiles = [
    { k: 'shuffle', Icon: ShuffleIcon, label: t('shuffle'), on: actions.shuffle },
    { k: 'play', Icon: PlayIcon, label: t('play_all'), on: actions.playAll },
    { k: 'mix', Icon: SparkleIcon, label: t('h_mix'), on: actions.mix },
    { k: 'snip', Icon: BoltIcon, label: t('snip_short'), on: actions.snippets, pro: snipPro },
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 14, gap: 10 }}>
        {tiles.map(x => (
          <Pressable key={x.k} onPress={x.on}
            style={({ pressed }) => [st.tile, { backgroundColor: pressed ? colors.accentSoft : colors.bgCard, borderColor: colors.border }]}>
            <x.Icon color={colors.ink} size={22} />
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginLeft: 10, flexShrink: 1 }}>{x.label}</Text>
            {x.pro ? <Text style={{ color: colors.ink, fontWeight: '800', fontSize: 10, marginLeft: 5 }}>PRO</Text> : null}
          </Pressable>
        ))}
      </View>

      {fresh.length ? (<>
        <Section title={t('h_new')} more={() => onMore('new')} />
        <Carousel list={fresh} />
      </>) : null}

      {rec.length ? (<>
        <Section title={t('h_rec')} right={
          <Pressable onPress={() => { setRecSeed(x => x + 1); player.playList(rec.map(s => s.id), null, { shuffle: true }); }}
            style={[st.pill, { borderColor: colors.border }]}>
            <ShuffleIcon color={colors.ink} size={16} />
            <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 6 }}>{t('shuffle')}</Text>
          </Pressable>
        } />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={rowW + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 14, gap: 12 }}>
          {cols.map((col, ci) => (
            <View key={ci} style={{ width: rowW, gap: 10 }}>
              {col.map(s => (
                <Pressable key={s.id} onPress={() => play(rec, s.id)}
                  style={({ pressed }) => [st.recRow, { backgroundColor: pressed ? colors.accentSoft : colors.bgCard, borderColor: colors.border }]}>
                  <Cover song={s} size={56} radius={10} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{s.title}</Text>
                    <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 13 }}>{s.artist || t('unknown_artist')}</Text>
                  </View>
                  <View style={[st.playCircle, { borderColor: colors.border }]}><PlayIcon color={colors.text} size={18} /></View>
                </Pressable>
              ))}
            </View>
          ))}
        </ScrollView>
      </>) : null}

      {top.length ? (<>
        <Section title={t('h_top')} more={() => onMore('top')} />
        <Carousel list={top} />
      </>) : null}

      {favs.length ? (<>
        <Section title={t('favorites')} more={() => onMore('fav')} />
        <Carousel list={favs} />
      </>) : null}
    </ScrollView>
  );
}

/** Вкладка «Плейлисты»: карточки; нажатие — песни плейлиста. */
export function PlaylistsView({ onOpen, onCreate }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 10, paddingBottom: 28 }}>
      <Pressable onPress={onCreate} style={[st.recRow, { borderColor: colors.border, borderStyle: 'dashed', backgroundColor: 'transparent' }]}>
        <View style={[st.plIcon, { backgroundColor: colors.accentSoft }]}><PlusIcon color={colors.ink} size={26} /></View>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginLeft: 12 }}>{t('pl_new')}</Text>
      </Pressable>
      {!lib.playlists.length ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>{t('pl_none')}</Text> : null}
      {lib.playlists.map(pl => {
        const first = pl.ids.map(id => lib.byId[id]).find(Boolean);
        return (
          <Pressable key={pl.id} onPress={() => onOpen(pl)}
            style={({ pressed }) => [st.recRow, { backgroundColor: pressed ? colors.accentSoft : colors.bgCard, borderColor: colors.border }]}>
            {first ? <Cover song={first} size={56} radius={10} /> : <View style={[st.plIcon, { backgroundColor: colors.accentSoft }]}><PlaylistIcon color={colors.ink} size={26} /></View>}
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{pl.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('songs_count', { n: pl.ids.length })}</Text>
            </View>
            <ChevRightIcon color={colors.textMuted} size={24} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Вкладка «Исполнители»: по числу прослушиваний, затем по числу песен; нажатие — его песни. */
export function ArtistsView({ onOpen }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  const list = useMemo(() => {
    const m = new Map();
    for (const s of lib.songs) for (const a of artistsOf(s)) {
      const r = m.get(a) || { name: a, n: 0, plays: 0, song: s };
      r.n++; r.plays += lib.playCount[s.id] || 0;
      if (!r.song.cover && s.cover) r.song = s;
      m.set(a, r);
    }
    return [...m.values()].sort((a, b) => b.plays - a.plays || b.n - a.n || a.name.localeCompare(b.name));
  }, [lib.songs, lib.playCount]);
  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, gap: 10, paddingBottom: 28 }}>
      {list.map(a => (
        <Pressable key={a.name} onPress={() => onOpen(a.name)}
          style={({ pressed }) => [st.recRow, { backgroundColor: pressed ? colors.accentSoft : colors.bgCard, borderColor: colors.border }]}>
          <Cover song={a.song} size={52} radius={26} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{a.name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('songs_count', { n: a.n })}</Text>
          </View>
          {a.plays ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
              <HeadphonesIcon color={colors.textMuted} size={14} />
              <Text style={{ color: colors.textMuted, fontSize: 13, marginLeft: 4 }}>{a.plays}</Text>
            </View>
          ) : null}
          <ChevRightIcon color={colors.textMuted} size={24} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  tab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22 },
  tile: { width: '48.5%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  playDot: { position: 'absolute', right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  recRow: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  playCircle: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  plIcon: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
