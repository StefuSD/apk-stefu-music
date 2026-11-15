import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { artistsOf } from '../utils/artists';
import { dayKey } from '../utils/format';
import Cover from './Cover';
import { AppGlyphIcon, CloseIcon, ShareIcon } from './icons';

const DAY = 86400000;

/** Итоги года по истории: время, песни, исполнители, лучший месяц, серия дней, любимый час. */
function useRecap(year) {
  const lib = useLibrary();
  return useMemo(() => {
    const from = new Date(year, 0, 1).getTime(), to = new Date(year + 1, 0, 1).getTime();
    const ev = lib.plays.filter(e => e.t >= from && e.t < to && e.d > 0);
    const info = id => lib.byId[id] || lib.ghosts[id] || { title: '?', artist: '' };
    let sec = 0, plays = 0;
    const songs = {}, artists = {}, tags = {}, months = new Array(12).fill(0), hours = new Array(24).fill(0);
    const days = new Set();
    for (const e of ev) {
      sec += e.d; plays += e.c;
      songs[e.s] = (songs[e.s] || 0) + e.d;
      const s = info(e.s);
      for (const a of artistsOf(s)) artists[a] = (artists[a] || 0) + e.d;
      for (const tg of s.tags || []) tags[tg] = (tags[tg] || 0) + e.d;
      const d = new Date(e.t);
      months[d.getMonth()] += e.d;
      hours[d.getHours()] += e.d;
      if (e.c) days.add(dayKey(e.t));
    }
    let best = 0, run = 0;
    for (let ts = from; ts < Math.min(to, Date.now() + DAY); ts += DAY) {
      if (days.has(dayKey(ts))) { run++; best = Math.max(best, run); } else run = 0;
    }
    const topOf = (m, n) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
    const mBest = months.indexOf(Math.max(...months));
    const hBest = hours.indexOf(Math.max(...hours));
    return {
      sec, plays, uniq: Object.keys(songs).length, days: days.size, streak: best,
      songs: topOf(songs, 5).map(([id, v]) => ({ id, v, song: lib.byId[id], ...info(id) })),
      artists: topOf(artists, 5), tag: topOf(tags, 1)[0],
      month: Math.max(...months) > 0 ? mBest : -1, hour: Math.max(...hours) > 0 ? hBest : -1,
    };
  }, [lib.plays, lib.byId, lib.ghosts, year]);
}

export default function YearRecap({ visible, onClose }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(new Date().getFullYear());
  const R = useRecap(year);
  const card = useRef(null);
  const [busy, setBusy] = useState(false);
  const lib = useLibrary();
  const years = useMemo(() => {
    const ys = new Set(lib.plays.map(p => new Date(p.t).getFullYear()));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [lib.plays]);

  const hours = Math.floor(R.sec / 3600), mins = Math.round((R.sec % 3600) / 60);
  const monthName = R.month >= 0 ? new Date(year, R.month, 15).toLocaleDateString(lang, { month: 'long' }) : '—';

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png' });
    } catch (e) { Alert.alert('', String(e?.message || e)); }
    setBusy(false);
  };

  const W = '#ffffff', M = '#ffffffa8';
  const Big = ({ v, label }) => (
    <View style={{ flex: 1 }}>
      <Text style={{ color: W, fontSize: 26, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit>{v}</Text>
      <Text style={{ color: M, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 8 }}>
          <Pressable onPress={onClose} hitSlop={10}><CloseIcon color={colors.text} size={26} /></Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 12 }}>
            {years.map(y => (
              <Pressable key={y} onPress={() => setYear(y)} style={[st.year, y === year ? { backgroundColor: colors.ink } : { borderWidth: 1, borderColor: colors.border }]}>
                <Text style={{ color: y === year ? colors.onInk : colors.text, fontWeight: '700' }}>{y}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          {/* Сама карточка — её и снимаем картинкой для «Поделиться». */}
          <View ref={card} collapsable={false} style={[st.card, { backgroundColor: '#18171a' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppGlyphIcon color={W} size={26} />
              <Text style={{ color: W, fontWeight: '700', marginLeft: 8, fontSize: 15, flex: 1 }}>Stefu Music</Text>
              <Text style={{ color: M, fontWeight: '700' }}>{year}</Text>
            </View>
            <Text style={{ color: W, fontSize: 30, fontWeight: '800', marginTop: 18 }}>{t('recap_title', { y: year })}</Text>
            {R.sec === 0 ? (
              <Text style={{ color: M, marginTop: 14, lineHeight: 20 }}>{t('recap_empty')}</Text>
            ) : (<>
              <View style={{ flexDirection: 'row', marginTop: 18 }}>
                <Big v={hours ? `${hours} ${t('recap_h')} ${mins} ${t('min_short')}` : `${mins} ${t('min_short')}`} label={t('r_time')} />
                <Big v={String(R.plays)} label={t('r_plays')} />
              </View>
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Big v={String(R.uniq)} label={t('r_songs')} />
                <Big v={String(R.streak)} label={t('recap_streak')} />
              </View>
              {R.songs[0] ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22, padding: 12, borderRadius: 16, backgroundColor: '#ffffff14' }}>
                  <Cover song={R.songs[0].song || { id: R.songs[0].id, title: R.songs[0].title, artist: R.songs[0].artist }} size={64} radius={12} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ color: M, fontSize: 12 }}>{t('recap_song')}</Text>
                    <Text style={{ color: W, fontSize: 18, fontWeight: '800' }} numberOfLines={2}>{R.songs[0].title}</Text>
                    <Text style={{ color: M }} numberOfLines={1}>{R.songs[0].artist}</Text>
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: 18, gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={st.h}>{t('r_top_songs')}</Text>
                  {R.songs.map((s, i) => (
                    <Text key={s.id} style={{ color: W, marginTop: 4 }} numberOfLines={1}><Text style={{ color: M, fontWeight: '700' }}>{i + 1}  </Text><Text style={{ fontWeight: '700' }}>{s.title}</Text></Text>
                  ))}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.h}>{t('r_top_artists')}</Text>
                  {R.artists.map(([a], i) => (
                    <Text key={a} style={{ color: W, marginTop: 4, fontWeight: '700' }} numberOfLines={1}><Text style={{ color: M }}>{i + 1}  </Text>{a}</Text>
                  ))}
                </View>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 18 }}>
                <Big v={monthName} label={t('recap_month')} />
                <Big v={R.hour >= 0 ? `${R.hour}:00` : '—'} label={t('recap_hour')} />
              </View>
              {R.tag ? <Text style={{ color: M, marginTop: 14 }}>{t('recap_tag')}: <Text style={{ color: W, fontWeight: '700' }}>{R.tag[0]}</Text></Text> : null}
            </>)}
          </View>
          <Pressable onPress={share} disabled={busy || R.sec === 0}
            style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, opacity: R.sec ? 1 : 0.5 }}>
            {busy ? <ActivityIndicator color={colors.onAccent} /> : <ShareIcon color={colors.onAccent} size={20} />}
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16, marginLeft: 8 }}>{t('recap_share')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: 24, padding: 20 },
  year: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  h: { color: '#ffffffa8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
});
