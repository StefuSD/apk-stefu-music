import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { ChartIcon, ClockIcon, PlayIcon, HeadphonesIcon, MusicIcon, FireIcon, TrophyIcon, ShuffleIcon, ArrowUpIcon, ArrowDownIcon, SparkleIcon, ChevLeftIcon, ChevRightIcon } from '../components/icons';
import YearRecap from '../components/YearRecap';
import { usePro } from '../pro/ProContext';

const PERIODS = [
  { k: 'week', days: 7 }, { k: 'month', days: 30 }, { k: 'year', days: 365 }, { k: 'all', days: null },
];
const DAY = 86400000;
// Альбом — вместе с исполнителем: «Greatest Hits» у разных исполнителей — разные альбомы.
const albumKey = s => (s.album || '').trim() + '\u0001' + (artistsOf(s)[0] || '');

/**
 * Календарный период для Топ-20: неделя (пн–вс), месяц или год; back — сколько
 * периодов назад (0 — текущий). Возвращает [начало, конец) в мс.
 */
function calRange(kind, back) {
  const n = new Date();
  if (kind === 'week') {
    const s = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (n.getDay() + 6) % 7 - 7 * back);
    return [s.getTime(), new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7).getTime()];
  }
  if (kind === 'month') return [new Date(n.getFullYear(), n.getMonth() - back, 1).getTime(), new Date(n.getFullYear(), n.getMonth() - back + 1, 1).getTime()];
  if (kind === 'year') return [new Date(n.getFullYear() - back, 0, 1).getTime(), new Date(n.getFullYear() - back + 1, 0, 1).getTime()];
  return [0, Infinity];
}

/** Подпись календарного периода: «10–16 нояб.», «ноябрь 2026», «2026». */
function calLabel(kind, from, to, lang) {
  const a = new Date(from), b = new Date(to - DAY);
  try {
    if (kind === 'week') {
      const bs = b.toLocaleDateString(lang, { day: 'numeric', month: 'short' });
      if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + bs;
      return a.toLocaleDateString(lang, { day: 'numeric', month: 'short' }) + ' – ' + bs
        + (a.getFullYear() !== b.getFullYear() ? ' ' + b.getFullYear() : '');
    }
    if (kind === 'month') {
      const m = a.toLocaleDateString(lang, { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  } catch (e) { /* */ }
  return kind === 'month' ? EN_MONTHS[a.getMonth()] + ' ' + a.getFullYear() : String(a.getFullYear());
}

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
      <View style={{ width: 26, alignItems: 'flex-start' }}>
        <Text style={{ color: colors.textMuted, fontWeight: '700' }}>{i + 1}</Text>
        {/* Место в прошлом таком же периоде: ▲ поднялась, ▼ опустилась; новые — без пометки. */}
        {r.delta === 'new' ? null
          : r.delta > 0 ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><ArrowUpIcon color={colors.text} size={10} /><Text style={{ color: colors.text, fontSize: 10, fontWeight: '700' }}>{r.delta}</Text></View>
          : r.delta < 0 ? <View style={{ flexDirection: 'row', alignItems: 'center' }}><ArrowDownIcon color={colors.textMuted} size={10} /><Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '700' }}>{-r.delta}</Text></View>
          : null}
      </View>
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
          <HeadphonesIcon color={colors.textMuted} size={13} style={{ marginRight: 2 }} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>{r.plays}</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fmtListen(r.sec, t)}</Text>
      </View>
    </Pressable>
  ));
}

/** Строка «ещё не слушали»: memo — при перерисовке экрана сотни строк не пересобираются. */
const NeverRow = memo(function NeverRow({ s, colors, t, onPlay }) {
  return (
    <Pressable onPress={() => onPlay(s.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
      <Cover song={s} size={40} radius={8} />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }} numberOfLines={1}>{s.title}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>{s.artist || t('unknown_artist')}</Text>
      </View>
    </Pressable>
  );
});

const NEVER_FIRST = 8, NEVER_STEP = 30;
/**
 * Список «ещё не слушали». «Показать все» дорисовывает строки порциями по кадрам —
 * экран не замирает, сколько бы песен ни было. Своё состояние — чтобы порции
 * не перерисовывали весь экран отчётов. collapseKey меняется — список сворачивается.
 */
const NeverList = memo(function NeverList({ songs, colors, t, onPlay, collapseKey }) {
  const [all, setAll] = useState(false);
  const [n, setN] = useState(NEVER_FIRST);
  useEffect(() => { setAll(false); setN(NEVER_FIRST); }, [collapseKey]);
  useEffect(() => {
    if (!all || n >= songs.length) return;
    const h = requestAnimationFrame(() => setN(x => x + NEVER_STEP));
    return () => cancelAnimationFrame(h);
  }, [all, n, songs.length]);
  const shown = songs.slice(0, all ? n : NEVER_FIRST);
  return (
    <>
      {shown.map(s => <NeverRow key={s.id} s={s} colors={colors} t={t} onPlay={onPlay} />)}
      {songs.length > NEVER_FIRST ? (
        <Pressable onPress={() => { if (all) { setAll(false); setN(NEVER_FIRST); } else setAll(true); }} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{all ? t('show_less') : t('show_all', { n: songs.length })}</Text>
        </Pressable>
      ) : null}
    </>
  );
});

// top — вкладка «Топ-20»: тот же расчёт за период, но на экране только топ песен.
export default function ReportsScreen({ route, navigation, top = false }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const player = usePlayer();
  const [period, setPeriod] = useState('month');
  const [kind, setKind] = useState('songs');      // Топ-20: songs | artists | albums | added
  const [back, setBack] = useState(0);            // Топ-20: сколько недель/месяцев/лет назад
  useEffect(() => { setBack(0); }, [period]);
  // Ушли с вкладки — длинный список «ещё не слушали» сворачивается: не держим сотни строк.
  const [blurs, setBlurs] = useState(0);
  useEffect(() => navigation && navigation.addListener('blur', () => setBlurs(b => b + 1)), [navigation]);
  const [recap, setRecap] = useState(false);
  const pro = usePro();

  // Ссылка com.stefu.music://reports?period=week (src/links/LinkHandler.js) — один раз на ссылку.
  const linkAt = route && route.params && route.params.linkAt;
  useEffect(() => {
    const p = linkAt && route.params.linkPeriod;
    if (p && PERIODS.some(x => x.k === p)) setPeriod(p);
  }, [linkAt]);

  const R = useMemo(() => {
    const p = PERIODS.find(x => x.k === period);
    const now = Date.now();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    // Отчёты — скользящие 7/30/365 дней; Топ-20 — календарные неделя, месяц, год с листанием назад.
    const [from, to] = top ? calRange(period, back) : [p.days ? today0.getTime() - (p.days - 1) * DAY : 0, Infinity];
    const ev = lib.plays.filter(e => e.t >= from && e.t < to && e.d > 0);
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

    const topN = (m, n = 10) => Object.entries(m).sort((a, b) => b[1].sec - a[1].sec).slice(0, n);

    // Прошлый такой же период — для стрелок в Топ-20 (у «всего времени» его нет).
    const prevRank = { songs: null, artists: null, albums: null };
    if (p.days) {
      const pFrom = top ? calRange(period, back + 1)[0] : from - p.days * DAY;
      const ps = {}, pa = {}, pal = {};
      for (const e of lib.plays) {
        if (e.t < pFrom || e.t >= from || !(e.d > 0)) continue;
        const s = info(e.s);
        add(ps, e.s, e);
        for (const ar of artistsOf(s)) add(pa, ar, e);
        if (s.album) add(pal, albumKey(s), e);
      }
      const rank = m => { const o = {}; Object.entries(m).sort((a, b) => b[1].sec - a[1].sec).forEach(([k], i) => { o[k] = i + 1; }); return o; };
      prevRank.songs = rank(ps); prevRank.artists = rank(pa); prevRank.albums = rank(pal);
    }
    const withDelta = (rows, ranks) => rows.map((r, i) => ({
      ...r, delta: !ranks ? undefined : ranks[r.key] ? ranks[r.key] - (i + 1) : 'new',
    }));
    // Новинки периода: песни, добавленные в библиотеку за эти неделю, месяц или год;
    // сверху — самые слушаемые за период. «За всё время» — просто самые свежие.
    const addedAll = top ? lib.songs.filter(s => (s.addedAt || 0) >= from && (s.addedAt || 0) < to) : [];
    const secOf = id => (bySong[id] ? bySong[id].sec : 0);
    addedAll.sort(p.days
      ? (a, b) => secOf(b.id) - secOf(a.id) || (b.addedAt || 0) - (a.addedAt || 0)
      : (a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const byAlbum = {};
    for (const e of ev) { const s = info(e.s); if (s.album) add(byAlbum, albumKey(s), e); }
    return {
      sec, plays, uniq: uniq.size, streak, series, avg: sec / daysSpan,
      hours: byHour.map((v, h) => ({ label: String(h), full: `${h}:00–${h}:59`, v: v / 60 })),
      topSongs: withDelta(topN(bySong, 20).map(([id, o]) => ({ key: id, id, label: info(id).title, sub: info(id).artist || t('unknown_artist'), ...o })), prevRank.songs),
      top20Artists: withDelta(topN(byArtist, 20).map(([k, o]) => ({ key: k, label: k, ...o })), prevRank.artists),
      top20Albums: withDelta(topN(byAlbum, 20).map(([k, o]) => {
        const [album, artist] = k.split('\u0001');
        return { key: k, label: album, sub: artist || t('unknown_artist'), album, ...o };
      }), prevRank.albums),
      topArtists: topN(byArtist).map(([k, o]) => ({ key: k, label: k, ...o })),
      topTags: topN(byTag).map(([k, o]) => ({ key: k, label: k,  ...o })),
      topGenres: topN(byGenre, 8).map(([k, o]) => ({ key: k, label: k, ...o })),
      topLangs: topN(byLang, 8).map(([k, o]) => ({ key: k, label: langName(k, lang), ...o })),
      addedIds: addedAll.map(s => s.id),
      topAdded: addedAll.slice(0, 100).map(s => ({
        key: s.id, id: s.id, label: s.title, sub: s.artist || t('unknown_artist'),
        sec: secOf(s.id), plays: bySong[s.id] ? bySong[s.id].plays : 0,
      })),
      never: top ? [] : lib.songs.filter(s => !lib.lastPlayed[s.id]),
      empty: ev.length === 0,
      from, to,
    };
  }, [lib.plays, lib.songs, lib.byId, lib.ghosts, lib.lastPlayed, period, back, top, lang, colors, t]);

  // Листать назад можно, пока период не раньше самого первого прослушивания.
  const firstPlay = useMemo(() => lib.plays.reduce((m, e) => (e.t < m ? e.t : m), Infinity), [lib.plays]);
  const canBack = top && period !== 'all' && R.from > firstPlay;

  // Постоянный обработчик: строки списка (memo) не перерисовываются от каждого прослушивания.
  const neverRef = useRef(R.never);
  neverRef.current = R.never;
  const playList = player.playList;
  const playNever = useCallback(id => playList(neverRef.current.map(x => x.id), id), [playList]);

  const minFmt = v => fmtListen(v * 60, t);
  const ids = R.topSongs.map(r => r.id).filter(id => lib.byId[id]);

  // Песни исполнителя или альбома из библиотеки — самые слушаемые первыми.
  const byPlays = (a, b) => (lib.playCount[b.id] || 0) - (lib.playCount[a.id] || 0);
  // Песни по исполнителю и альбому — один проход по библиотеке, а не проход на каждую строку.
  const songIndex = useMemo(() => {
    const art = {}, alb = {};
    if (!top) return { art, alb };
    for (const s of lib.songs) {
      for (const a of artistsOf(s)) (art[a.toLowerCase()] || (art[a.toLowerCase()] = [])).push(s);
      if (s.album) (alb[albumKey(s)] || (alb[albumKey(s)] = [])).push(s);
    }
    return { art, alb };
  }, [top, lib.songs]);
  const songsOfArtist = name => [...(songIndex.art[name.toLowerCase()] || [])].sort(byPlays).map(s => s.id);
  const songsOfAlbum = key => [...(songIndex.alb[key] || [])].sort((a, b) => (a.addedAt - b.addedAt)).map(s => s.id);
  const kindRows = kind === 'artists' ? R.top20Artists : kind === 'albums' ? R.top20Albums : kind === 'added' ? R.topAdded : R.topSongs;
  // Новинки показываем, даже если за период ничего не слушали.
  const kindEmpty = kind === 'added' ? !R.topAdded.length : R.empty || !kindRows.length;
  // «Играть все» в Топ-20: песни по местам; для исполнителей и альбомов — их песни подряд.
  const topQueue = () => {
    if (kind === 'songs') return ids;
    if (kind === 'added') return R.addedIds;
    const out = [];
    for (const r of kindRows) for (const id of (kind === 'artists' ? songsOfArtist(r.key) : songsOfAlbum(r.key))) if (!out.includes(id)) out.push(id);
    return out;
  };
  const rowsWithPress = kind === 'songs'
    ? R.topSongs.map(r => ({ ...r, onPress: lib.byId[r.id] ? () => player.playList(ids, r.id) : undefined }))
    : kind === 'added'
    ? R.topAdded.map(r => ({ ...r, onPress: () => player.playList(R.addedIds, r.id) }))
    : kindRows.map(r => {
      const q = kind === 'artists' ? songsOfArtist(r.key) : songsOfAlbum(r.key);
      return { ...r, onPress: q.length ? () => player.playList(q, q[0]) : undefined };
    });
  const leadFor = r => {
    if (kind === 'songs' || kind === 'added') return <Cover song={lib.byId[r.id] || { title: r.label, artist: r.sub }} size={40} radius={8} />;
    const firstId = (kind === 'artists' ? songsOfArtist(r.key) : songsOfAlbum(r.key)).find(id => lib.byId[id] && lib.byId[id].cover)
      || (kind === 'artists' ? songsOfArtist(r.key) : songsOfAlbum(r.key))[0];
    return <Cover song={lib.byId[firstId] || { id: r.key, title: r.label, artist: r.sub || r.label }} size={40} radius={kind === 'artists' ? 20 : 8} />;
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 10 }]}>
        {/* Топ-20 за неделю, месяц или год: название периода — в шапке
            вместо слова «Топ-20» (и так понятно), стрелки рядом. Под переключателем периода
            строки больше нет. «За всё время» — просто «Топ-20». */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {top ? <TrophyIcon color={colors.headerText} size={26} /> : <ChartIcon color={colors.headerText} size={26} />}
          {top && period !== 'all' ? (
            <>
              <Pressable onPress={() => setBack(0)} style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: colors.headerText, fontSize: 20, fontWeight: '600', letterSpacing: 0.3 }} numberOfLines={1} adjustsFontSizeToFit>{calLabel(period, R.from, R.to, lang)}</Text>
              </Pressable>
              <Pressable onPress={() => setBack(b => b + 1)} disabled={!canBack} hitSlop={10} style={[st.navBtn, { backgroundColor: colors.headerBtn, opacity: canBack ? 1 : 0.35, marginLeft: 8 }]}>
                <ChevLeftIcon color={colors.headerText} size={22} />
              </Pressable>
              <Pressable onPress={() => setBack(b => Math.max(0, b - 1))} disabled={back === 0} hitSlop={10} style={[st.navBtn, { backgroundColor: colors.headerBtn, opacity: back ? 1 : 0.35, marginLeft: 8 }]}>
                <ChevRightIcon color={colors.headerText} size={22} />
              </Pressable>
            </>
          ) : (
            <Text style={{ flex: 1, color: colors.headerText, fontSize: 20, fontWeight: '600', marginLeft: 10, letterSpacing: 0.3 }}>{t(top ? 'nav_top' : 'nav_reports')}</Text>
          )}
          {/* Топ-20: «Играть» и «Вперемешку» — иконками прямо в шапке. */}
          {top && !kindEmpty ? (
            <>
              <Pressable onPress={() => { const q = topQueue(); if (q.length) player.playList(q, q[0]); }} hitSlop={6}
                style={[st.navBtn, { backgroundColor: colors.headerText, marginLeft: 12 }]}>
                <PlayIcon color={colors.bgHeader} size={22} />
              </Pressable>
              <Pressable onPress={() => { const q = topQueue(); if (q.length) player.playList(q, null, { shuffle: true }); }} hitSlop={6}
                style={[st.navBtn, { backgroundColor: colors.headerBtn, marginLeft: 8 }]}>
                <ShuffleIcon color={colors.headerText} size={20} />
              </Pressable>
            </>
          ) : null}
        </View>
        <View style={[st.seg, { backgroundColor: colors.headerBtn }]}>
          {PERIODS.map(p => (
            <Pressable key={p.k} onPress={() => setPeriod(p.k)} style={[st.segItem, period === p.k && { backgroundColor: colors.mode === 'night' ? colors.accent : '#fff' }]}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: period === p.k ? (colors.mode === 'night' ? '#000' : colors.accent) : colors.headerText }}>{t((top && p.k !== 'all' ? 'tp_' : 'r_') + p.k)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {top ? (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
          <View style={[st.kinds, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            {['songs', 'artists', 'albums', 'added'].map(k => (
              <Pressable key={k} onPress={() => setKind(k)} style={[st.kind, kind === k && { backgroundColor: colors.ink }]}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontWeight: '700', fontSize: 13, color: kind === k ? colors.onInk : colors.text }}>{t('top_' + k)}</Text>
              </Pressable>
            ))}
          </View>
          {kindEmpty ? (
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 30, paddingHorizontal: 20, lineHeight: 21 }}>{t(kind === 'added' ? 'top_no_added' : R.empty ? 'r_empty' : 'top_no_albums')}</Text>
          ) : (<>
            <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
              <TopList rows={rowsWithPress} colors={colors} t={t} renderLead={leadFor} />
              {kind === 'added' ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t(period === 'all' ? 'top_added_hint_all' : 'top_added_hint')}</Text>
                : period !== 'all' ? <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>{t('top_delta_hint')}</Text> : null}
            </View>
          </>)}
        </ScrollView>
      ) : (
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
        {lib.plays.length > 0 && (
          <Pressable onPress={() => setRecap(true)} style={[st.recap, { backgroundColor: colors.ink }]}>
            <SparkleIcon color={colors.onInk} size={22} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.onInk, fontWeight: '800', fontSize: 16 }}>{t('recap_title', { y: new Date().getFullYear() })}</Text>
              <Text style={{ color: colors.onInk + 'b0', fontSize: 12, marginTop: 2 }}>{t('recap_sub')}</Text>
            </View>
          </Pressable>
        )}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile colors={colors} icon={<ClockIcon color={colors.accent} size={20} />} label={t('r_time')} value={fmtListen(R.sec, t)} />
          <Tile colors={colors} icon={<HeadphonesIcon color={colors.accent} size={20} />} label={t('r_plays')} value={String(R.plays)} />
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
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 6 }}>
              <Pressable onPress={() => player.playList(R.never.map(x => x.id), R.never[0].id)} style={[st.act, { backgroundColor: colors.ink, paddingVertical: 7 }]}>
                <PlayIcon color={colors.onInk} size={18} />
                <Text style={{ color: colors.onInk, fontWeight: '600', marginLeft: 4 }}>{t('play_all')}</Text>
              </Pressable>
              <Pressable onPress={() => player.playList(R.never.map(x => x.id), null, { shuffle: true })}
                style={[st.act, { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.textMuted, paddingVertical: 7 }]}>
                <ShuffleIcon color={colors.text} size={18} />
                <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 6 }}>{t('shuffle')}</Text>
              </Pressable>
            </View>
            {/* Незнакомые песни — по припевам: понравилась — сердечко или «Слушать целиком». */}
            <Pressable onPress={() => { if (pro.requireRoom('snippetsDay', player.snipUsed)) player.playList(R.never.map(x => x.id), null, { shuffle: true, snippets: true }); }}
              style={[st.act, { backgroundColor: colors.accentSoft, alignSelf: 'flex-start', marginBottom: 6, paddingVertical: 7 }]}>
              <SparkleIcon color={colors.accent} size={18} />
              <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 6 }}>{t('snip_never')}</Text>
              {player.snipUsed >= pro.limit('snippetsDay') ? <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 10, marginLeft: 5 }}>PRO</Text> : null}
            </Pressable>
            {/* Как строки «Топ-20»: обложка, жирное название, ниже исполнитель. */}
            <NeverList songs={R.never} colors={colors} t={t} onPlay={playNever} collapseKey={blurs + ':' + period} />
          </Card>
        )}
      </ScrollView>
      )}
      {!top ? <YearRecap visible={recap} onClose={() => setRecap(false)} /> : null}
    </View>
  );
}

const st = StyleSheet.create({
  header: { paddingHorizontal: 14, paddingBottom: 12 },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 3, marginTop: 12 },
  nav: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  navBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 11 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginTop: 12 },
  kinds: { flexDirection: 'row', borderRadius: 14, padding: 3, borderWidth: 1 },
  kind: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 11 },
  act: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  recap: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, marginBottom: 12 },
});
