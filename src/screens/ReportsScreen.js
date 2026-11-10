import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer } from '../context/PlayerContext';
import { fmtListen, dayKey } from '../utils/format';
import { langName } from '../utils/languages';
import { artistsOf } from '../utils/artists';
import Cover from '../components/Cover';
import { ChartIcon, ClockIcon, PlayIcon, MusicIcon, FireIcon } from '../components/icons';

const PERIODS = [
  { k: 'week', days: 7 }, { k: 'month', days: 30 }, { k: 'year', days: 365 }, { k: 'all', days: null },
];
const DAY = 86400000;

// Короткие названия месяцев на языке интерфейса (Intl), запасной вариант — английские.
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function monthNames(lang) {
  try { return EN_MONTHS.map((_, m) => new Date(2024, m, 15).toLocaleDateString(lang, { month: 'short' }).replace('.', '')); }
  catch (e) { return EN_MONTHS; }
}

/** Одна серия столбиков: тап по столбику — подпись со значением. */
function Bars({ data, colors, format, height = 120 }) {
  const [sel, setSel] = useState(null);
  const max = Math.max(1, ...data.map(d => d.v));
  const shown = sel != null ? data[sel] : null;
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <View>
      <Text style={{ color: colors.textMuted, fontSize: 12, height: 18 }}>
        {shown ? `${shown.full || shown.label}: ` : ' '}
        {shown ? <Text style={{ color: colors.text, fontWeight: '700' }}>{format(shown.v)}</Text> : null}
      </Text>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {data.map((d, i) => (
          <Pressable key={i} onPress={() => setSel(sel === i ? null : i)} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 }}>
            <View style={{
              height: d.v ? Math.max(3, (d.v / max) * (height - 4)) : 0,
              backgroundColor: sel === i ? colors.text : colors.accent,
              borderTopLeftRadius: 4, borderTopRightRadius: 4,
              opacity: sel != null && sel !== i ? 0.45 : 1,
            }} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {data.map((d, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 10, color: colors.textMuted, textAlign: 'center' }} numberOfLines={1}>
            {i % labelEvery === 0 ? d.label : ''}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Tile({ icon, label, value, colors }) {
  return (
    <View style={[st.tile, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      {icon}
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 6 }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Card({ title, children, colors }) {
  return (
    <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

/** Топ-список: полоса длины по времени прослушивания, справа — цифры. */
function TopList({ rows, colors, t, renderLead }) {
  const max = Math.max(1, ...rows.map(r => r.sec));
  return rows.map((r, i) => (
    <Pressable key={r.key} onPress={r.onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Text style={{ color: colors.textMuted, width: 22, fontWeight: '700' }}>{i + 1}</Text>
      {renderLead ? renderLead(r) : null}
      <View style={{ flex: 1, marginLeft: renderLead ? 10 : 0 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{r.label}</Text>
        {r.sub ? <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{r.sub}</Text> : null}
        <View style={{ height: 6, marginTop: 4, borderRadius: 3, backgroundColor: colors.bgInput }}>
          <View style={{ height: 6, borderRadius: 3, width: `${(r.sec / max) * 100}%`, backgroundColor: r.color || colors.accent }} />
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', marginLeft: 10, minWidth: 64 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <PlayIcon color={colors.textMuted} size={14} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{r.plays}</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fmtListen(r.sec, t)}</Text>
      </View>
    </Pressable>
  ));
}

export default function ReportsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const player = usePlayer();
  const [period, setPeriod] = useState('month');

  const R = useMemo(() => {
    const p = PERIODS.find(x => x.k === period);
    const now = Date.now();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const from = p.days ? today0.getTime() - (p.days - 1) * DAY : 0;
    const ev = lib.plays.filter(e => e.t >= from && e.d > 0);
    const info = id => lib.byId[id] || lib.ghosts[id] || { title: '?', artist: '', tags: [], genre: '' };

    let sec = 0, plays = 0;
    const uniq = new Set();
    const bySong = {}, byArtist = {}, byTag = {}, byGenre = {}, byLang = {}, byDay = {}, byMonth = {}, byHour = new Array(24).fill(0);
    const add = (m, k, e) => { if (!k) return; const o = m[k] || (m[k] = { sec: 0, plays: 0 }); o.sec += e.d; o.plays += e.c; };
    for (const e of ev) {
      sec += e.d; plays += e.c;
      uniq.add(e.s);
      const s = info(e.s);
      add(bySong, e.s, e);
      const arts = artistsOf(s);
      if (arts.length) for (const ar of arts) add(byArtist, ar, e);
      else add(byArtist, t('unknown_artist'), e);
      for (const tg of s.tags || []) add(byTag, tg, e);
      for (const l of s.langs || []) add(byLang, l, e);
      add(byGenre, s.genre, e);
      const d = new Date(e.t);
      byDay[dayKey(e.t)] = (byDay[dayKey(e.t)] || 0) + e.d;
      const mk = d.getFullYear() * 12 + d.getMonth();
      byMonth[mk] = (byMonth[mk] || 0) + e.d;
      byHour[d.getHours()] += e.d;
    }

    // Серия дней подряд — по всей истории, до сегодня (или вчера).
    const allDays = new Set(lib.plays.filter(e => e.c).map(e => dayKey(e.t)));
    let streak = 0;
    let cur = today0.getTime();
    if (!allDays.has(dayKey(cur))) cur -= DAY;
    while (allDays.has(dayKey(cur))) { streak++; cur -= DAY; }

    // Столбики: дни для 7/30, месяцы для года и всего времени.
    let series;
    if (p.days && p.days <= 30) {
      series = [];
      for (let i = p.days - 1; i >= 0; i--) {
        const ts = today0.getTime() - i * DAY;
        const d = new Date(ts);
        series.push({
          label: p.days === 7 ? d.toLocaleDateString(lang, { weekday: 'short' }) : String(d.getDate()),
          full: d.toLocaleDateString(lang, { day: 'numeric', month: 'long' }),
          v: (byDay[dayKey(ts)] || 0) / 60,
        });
      }
    } else {
      const nowD = new Date();
      const endK = nowD.getFullYear() * 12 + nowD.getMonth();
      const keys = Object.keys(byMonth).map(Number);
      const startK = p.days ? endK - 11 : Math.min(endK - 11, ...(keys.length ? keys : [endK]));
      series = [];
      for (let k = Math.max(startK, endK - 35); k <= endK; k++) {
        const m = monthNames(lang);
        series.push({ label: m[k % 12], full: m[k % 12] + ' ' + Math.floor(k / 12), v: (byMonth[k] || 0) / 60 });
      }
    }
    const daysSpan = p.days || Math.max(1, Math.ceil((now - Math.min(now, ...ev.map(e => e.t))) / DAY));

    const top = (m, n = 10) => Object.entries(m).sort((a, b) => b[1].sec - a[1].sec).slice(0, n);
    return {
      sec, plays, uniq: uniq.size, streak, series, avg: sec / daysSpan,
      hours: byHour.map((v, h) => ({ label: String(h), full: `${h}:00–${h}:59`, v: v / 60 })),
      topSongs: top(bySong, 20).map(([id, o]) => ({ key: id, id, label: info(id).title, sub: info(id).artist || t('unknown_artist'), ...o })),
      topArtists: top(byArtist).map(([k, o]) => ({ key: k, label: k, ...o })),
      topTags: top(byTag).map(([k, o]) => ({ key: k, label: k,  ...o })),
      topGenres: top(byGenre, 8).map(([k, o]) => ({ key: k, label: k, ...o })),
      topLangs: top(byLang, 8).map(([k, o]) => ({ key: k, label: langName(k, lang), ...o })),
      never: lib.songs.filter(s => !lib.lastPlayed[s.id]),
      empty: ev.length === 0,
    };
  }, [lib.plays, lib.songs, lib.byId, lib.ghosts, lib.lastPlayed, period, lang, colors, t]);

  const minFmt = v => fmtListen(v * 60, t);
  const ids = R.topSongs.map(r => r.id).filter(id => lib.byId[id]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <ChartIcon color={colors.headerText} size={26} />
          <Text style={{ color: colors.headerText, fontSize: 20, fontWeight: '600', marginLeft: 10, letterSpacing: 0.3 }}>{t('nav_reports')}</Text>
        </View>
        <View style={[st.seg, { backgroundColor: colors.headerBtn }]}>
          {PERIODS.map(p => (
            <Pressable key={p.k} onPress={() => setPeriod(p.k)} style={[st.segItem, period === p.k && { backgroundColor: colors.mode === 'night' ? colors.accent : '#fff' }]}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: period === p.k ? (colors.mode === 'night' ? '#000' : colors.accent) : colors.headerText }}>{t('r_' + p.k)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile colors={colors} icon={<ClockIcon color={colors.accent} size={20} />} label={t('r_time')} value={fmtListen(R.sec, t)} />
          <Tile colors={colors} icon={<PlayIcon color={colors.accent} size={20} />} label={t('r_plays')} value={String(R.plays)} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Tile colors={colors} icon={<MusicIcon color={colors.accent} size={20} />} label={t('r_songs')} value={String(R.uniq)} />
          <Tile colors={colors} icon={<FireIcon color={colors.accent} size={20} />} label={t('r_streak')} value={String(R.streak)} />
        </View>

        {R.empty ? (
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 30, paddingHorizontal: 20, lineHeight: 21 }}>{t('r_empty')}</Text>
        ) : (
          <>
            <Card colors={colors} title={t(R.series.length <= 30 && period !== 'year' && period !== 'all' ? 'r_by_day' : 'r_by_month')}>
              <Bars data={R.series} colors={colors} format={minFmt} />
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t('r_avg_day', { v: fmtListen(R.avg, t) })}</Text>
            </Card>
            <Card colors={colors} title={t('r_top_songs')}>
              <TopList rows={R.topSongs.map(r => ({ ...r, onPress: lib.byId[r.id] ? () => player.playList(ids, r.id) : undefined }))}
                colors={colors} t={t}
                renderLead={r => <Cover song={lib.byId[r.id] || { title: r.label, artist: r.sub }} size={40} radius={8} />} />
            </Card>
            <Card colors={colors} title={t('r_top_artists')}>
              <TopList rows={R.topArtists} colors={colors} t={t} />
            </Card>
            {R.topTags.length > 0 && (
              <Card colors={colors} title={t('r_top_tags')}>
                <TopList rows={R.topTags} colors={colors} t={t} />
              </Card>
            )}
            {R.topLangs.length > 0 && (
              <Card colors={colors} title={t('r_top_langs')}>
                <TopList rows={R.topLangs} colors={colors} t={t} />
              </Card>
            )}
            {R.topGenres.length > 0 && (
              <Card colors={colors} title={t('r_top_genres')}>
                <TopList rows={R.topGenres} colors={colors} t={t} />
              </Card>
            )}
            <Card colors={colors} title={t('r_by_hour')}>
              <Bars data={R.hours} colors={colors} format={minFmt} height={90} />
            </Card>
          </>
        )}
        {R.never.length > 0 && lib.plays.length > 0 && (
          <Card colors={colors} title={`${t('r_never')} · ${R.never.length}`}>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 6 }}>{t('r_never_hint')}</Text>
            {R.never.slice(0, 8).map(s => (
              <Pressable key={s.id} onPress={() => player.playList(R.never.map(x => x.id), s.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                <Cover song={s} size={34} radius={7} />
                <Text style={{ color: colors.text, marginLeft: 10, flex: 1 }} numberOfLines={1}>{s.title}<Text style={{ color: colors.textMuted }}>{s.artist ? ' · ' + s.artist : ''}</Text></Text>
              </Pressable>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingBottom: 12 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 3, marginTop: 12 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 11 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 12 },
});
