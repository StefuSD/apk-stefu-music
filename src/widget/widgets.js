import React from 'react';
import { FlexWidget, TextWidget, SvgWidget, ImageWidget, OverlapWidget } from 'react-native-android-widget';
import { translate } from '../i18n';
import { SCHEME, widgetContext, coverData } from './data';

/**
 * Виджеты Stefu Music (кроме старого «Player» 4×1 — PlayerWidget.js):
 *   PlayerLarge 4×2 — обложка, песня, прогресс, «назад / играть / вперёд», сердечко
 *   Cover       2×2 — только обложка, «играть / пауза» поверх
 *   Actions     4×1 — «Вперемешку», «Микс для вас», «Сниппеты», «Таймер сна»
 *   Playlists   4×2 — плитки плейлистов
 *   TopWeek     4×2 — самые слушаемые песни этой недели
 *   Stats       2×2 — минуты сегодня и за неделю, любимый исполнитель недели
 *   ShortSnippets / ShortMix / ShortSleep 1×1 — одно действие (выбирается в списке виджетов)
 *
 * Кнопки: если приложение в памяти (live) — команда выполняется сразу (clickAction, см.
 * widgetTaskHandler.js); иначе кнопка открывает приложение ссылкой <пакет>://… (src/links/links.js).
 * Оформление — фирменный сиреневый градиент, белые одноцветные значки.
 */

const BG = { from: '#6d36c6', to: '#2a0f55', orientation: 'TL_BR' };
const W = '#ffffff';
const MUTED = '#ffffffb0';
const TILE = '#ffffff1f';

const svg = (d, color = W) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${d}"/></svg>`;
const P = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  heartOff: 'M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z',
  shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  sparkle: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
  bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  moon: 'M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96z',
  playlist: 'M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z',
  trophy: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z',
  headphones: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
  chart: 'M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z',
};
// Знак приложения — две ноты (как в иконке).
const NOTES = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6.65 -4 108 108"><g fill="#ffffff">'
  + '<ellipse cx="25.36" cy="83.44" rx="11.79" ry="10.38" transform="rotate(-18 25.36 83.44)"/>'
  + '<ellipse cx="69.36" cy="72.44" rx="11.79" ry="10.38" transform="rotate(-18 69.36 72.44)"/>'
  + '<path d="M31.8 22.7H36.9V83.4H31.8ZM75.8 6.9L81 6V72.4H75.8ZM31.8 22.5L81 6V28L31.8 44.5Z"/></g></svg>';

/** Нажатие: живая команда или ссылка. cmd — TOGGLE/NEXT/PREV/FAV; link — путь ссылки (mix, play?id=…). */
function click(live, { cmd, link }) {
  if (live && cmd) return { clickAction: cmd };
  if (live && link) return { clickAction: 'LINK', clickActionData: { link } };
  if (link) return { clickAction: 'OPEN_URI', clickActionData: { uri: `${SCHEME}://${link}` } };
  if (cmd === 'TOGGLE') return { clickAction: 'OPEN_URI', clickActionData: { uri: `${SCHEME}://play` } };
  if (cmd === 'NEXT' || cmd === 'PREV') return { clickAction: 'OPEN_URI', clickActionData: { uri: `${SCHEME}://${cmd.toLowerCase()}` } };
  return { clickAction: 'OPEN_APP' };
}
const CMD_LINK = { TOGGLE: 'play', NEXT: 'next', PREV: 'prev' };

const Icon = ({ d, size = 24, color }) => <SvgWidget svg={svg(d, color)} style={{ width: size, height: size }} />;

function Btn({ d, size = 26, box = 44, live, cmd, link, filled }) {
  return (
    <FlexWidget {...click(live, { cmd, link: !live && cmd ? CMD_LINK[cmd] : link })}
      style={{ width: box, height: box, borderRadius: box / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? W : '#00000000' }}>
      <Icon d={d} size={size} color={filled ? '#3a1466' : W} />
    </FlexWidget>
  );
}

function Header({ d, text, link, live }) {
  return (
    <FlexWidget {...click(live, { link })} style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginBottom: 6 }}>
      <Icon d={d} size={16} />
      <TextWidget text={text} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '700', color: W, marginLeft: 6 }} />
    </FlexWidget>
  );
}

function Shell({ children, padding = 12, ...rest }) {
  return (
    <FlexWidget {...rest} style={{ width: 'match_parent', height: 'match_parent', backgroundGradient: BG, borderRadius: 22, padding, flexDirection: 'column' }}>
      {children}
    </FlexWidget>
  );
}

function Art({ uri, size, radius = 14 }) {
  if (uri) return <ImageWidget image={uri} imageWidth={size} imageHeight={size} radius={radius} resizeMode="cover" />;
  return (
    <FlexWidget style={{ width: size, height: size, borderRadius: radius, backgroundColor: TILE, alignItems: 'center', justifyContent: 'center' }}>
      <SvgWidget svg={NOTES} style={{ width: Math.round(size * 0.55), height: Math.round(size * 0.55) }} />
    </FlexWidget>
  );
}

const mmss = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const fmtMin = (m, t) => (m >= 60 ? `${Math.floor(m / 60)} ${t('hour_short')} ${m % 60} ${t('min_short')}` : `${m} ${t('min_short')}`);

// ---------- Большой плеер 4×2 ----------
function PlayerLarge({ live, now, t, cover, w, h }) {
  const art = Math.max(64, Math.min(h - 24, 130));
  const right = Math.max(80, w - 24 - art - 12);
  const pos = now.duration ? Math.min(1, (now.pos || 0) / now.duration) : 0;
  return (
    <Shell>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 'match_parent' }}>
        <FlexWidget clickAction="OPEN_APP"><Art uri={cover} size={art} /></FlexWidget>
        <FlexWidget style={{ flex: 1, marginLeft: 12, flexDirection: 'column', height: 'match_parent', justifyContent: 'space-between' }}>
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent' }}>
            <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, flexDirection: 'column' }}>
              <TextWidget text={now.title || 'Stefu Music'} maxLines={1} truncate="END" style={{ fontSize: 16, fontWeight: '700', color: W }} />
              <TextWidget text={now.artist || ' '} maxLines={1} truncate="END" style={{ fontSize: 13, color: MUTED, marginTop: 2 }} />
            </FlexWidget>
            {now.id ? <Btn d={now.fav ? P.heart : P.heartOff} size={22} box={36} live={live} cmd="FAV" /> : null}
          </FlexWidget>
          {now.duration ? (
            <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
              <FlexWidget style={{ width: right, height: 4, borderRadius: 2, backgroundColor: '#ffffff40', flexDirection: 'row' }}>
                <FlexWidget style={{ width: Math.max(4, Math.round(right * pos)), height: 4, borderRadius: 2, backgroundColor: W }} />
              </FlexWidget>
              <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', marginTop: 3 }}>
                <TextWidget text={mmss(now.pos)} style={{ fontSize: 11, color: MUTED }} />
                <FlexWidget style={{ flex: 1 }} />
                <TextWidget text={mmss(now.duration)} style={{ fontSize: 11, color: MUTED }} />
              </FlexWidget>
            </FlexWidget>
          ) : null}
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: 'match_parent' }}>
            <Btn d={P.prev} live={live} cmd="PREV" />
            <FlexWidget style={{ width: 10 }} />
            <Btn d={now.playing ? P.pause : P.play} size={28} box={48} live={live} cmd="TOGGLE" filled />
            <FlexWidget style={{ width: 10 }} />
            <Btn d={P.next} live={live} cmd="NEXT" />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

// ---------- Обложка 2×2 ----------
function Cover({ live, now, cover, w, h }) {
  const size = Math.max(60, Math.min(w, h));
  return (
    <OverlapWidget style={{ width: 'match_parent', height: 'match_parent', borderRadius: 22 }} clickAction="OPEN_APP">
      {cover
        ? <ImageWidget image={cover} imageWidth={size} imageHeight={size} radius={22} resizeMode="cover" style={{ width: 'match_parent', height: 'match_parent' }} />
        : (
          <FlexWidget style={{ width: 'match_parent', height: 'match_parent', backgroundGradient: BG, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <SvgWidget svg={NOTES} style={{ width: Math.round(size * 0.4), height: Math.round(size * 0.4) }} />
          </FlexWidget>
        )}
      <FlexWidget style={{ width: 'match_parent', height: 'match_parent', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 22,
          backgroundGradient: { from: '#00000000', to: '#000000b8', orientation: 'TOP_BOTTOM' } }}>
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget text={now.title || 'Stefu Music'} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '700', color: W }} />
            {now.artist ? <TextWidget text={now.artist} maxLines={1} truncate="END" style={{ fontSize: 11, color: MUTED }} /> : null}
          </FlexWidget>
          <Btn d={now.playing ? P.pause : P.play} size={22} box={38} live={live} cmd="TOGGLE" filled />
        </FlexWidget>
      </FlexWidget>
    </OverlapWidget>
  );
}

// ---------- Быстрые действия 4×1 ----------
const ACTIONS = [
  { d: P.shuffle, k: 'shuffle', link: 'shuffle' },
  { d: P.sparkle, k: 'h_mix', link: 'mix' },
  { d: P.bolt, k: 'snip_short', link: 'snippets' },
  { d: P.moon, k: 'sleep', link: 'sleep?min=30' },
];
function Actions({ live, t }) {
  return (
    <Shell padding={6}>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', height: 'match_parent', alignItems: 'center' }}>
        {ACTIONS.map(a => (
          <FlexWidget key={a.k} {...click(live, { link: a.link })}
            style={{ flex: 1, height: 'match_parent', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: 16 }}>
            <Icon d={a.d} size={24} />
            <TextWidget text={t(a.k)} maxLines={1} truncate="END" style={{ fontSize: 11, color: W, marginTop: 4 }} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}

// ---------- Плейлисты 4×2 ----------
function Playlists({ live, data, t, h }) {
  const list = data.playlists || [];
  const rows = Math.max(1, Math.min(3, Math.floor((h - 46) / 46)));
  const items = list.slice(0, rows * 2);
  return (
    <Shell>
      <Header d={P.playlist} text={t('tab_playlists')} live={live} link="library" />
      {!items.length ? (
        <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={t('w_no_pl')} style={{ fontSize: 13, color: MUTED }} />
        </FlexWidget>
      ) : Array.from({ length: Math.ceil(items.length / 2) }, (_, r) => (
        <FlexWidget key={r} style={{ flexDirection: 'row', width: 'match_parent', marginTop: r ? 6 : 0 }}>
          {[0, 1].map(c => {
            const pl = items[r * 2 + c];
            if (!pl) return <FlexWidget key={c} style={{ flex: 1, marginLeft: c ? 6 : 0 }} />;
            return (
              <FlexWidget key={c} {...click(live, { link: 'playlist?name=' + encodeURIComponent(pl.name) })}
                style={{ flex: 1, marginLeft: c ? 6 : 0, height: 40, borderRadius: 12, backgroundColor: TILE, paddingHorizontal: 10, flexDirection: 'column', justifyContent: 'center' }}>
                <TextWidget text={pl.name} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '700', color: W }} />
                <TextWidget text={t('songs_count', { n: pl.n })} maxLines={1} style={{ fontSize: 10, color: MUTED }} />
              </FlexWidget>
            );
          })}
        </FlexWidget>
      ))}
    </Shell>
  );
}

// ---------- Топ недели 4×2 ----------
function TopWeek({ live, data, t, h }) {
  const rows = Math.max(1, Math.min(6, Math.floor((h - 44) / 32)));
  const items = (data.top || []).slice(0, rows);
  return (
    <Shell>
      <Header d={P.trophy} text={t('w_top_week')} live={live} link="top?period=week" />
      {!items.length ? (
        <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text={t('w_no_plays')} style={{ fontSize: 13, color: MUTED }} />
        </FlexWidget>
      ) : items.map((s, i) => (
        <FlexWidget key={s.id} {...click(live, { link: 'play?id=' + encodeURIComponent(s.id) })}
          style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', height: 32 }}>
          <TextWidget text={String(i + 1)} style={{ fontSize: 14, fontWeight: '700', color: MUTED, width: 20 }} />
          <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
            <TextWidget text={s.title} maxLines={1} truncate="END" style={{ fontSize: 13, fontWeight: '700', color: W }} />
            <TextWidget text={s.artist || ' '} maxLines={1} truncate="END" style={{ fontSize: 10, color: MUTED }} />
          </FlexWidget>
          <Icon d={P.headphones} size={12} color={MUTED} />
          <TextWidget text={String(s.n)} style={{ fontSize: 12, color: MUTED, marginLeft: 3 }} />
        </FlexWidget>
      ))}
    </Shell>
  );
}

// ---------- Статистика 2×2 ----------
function Stats({ live, data, t }) {
  const s = data.stats || { todayMin: 0, weekMin: 0, artist: '' };
  return (
    <Shell {...click(live, { link: 'reports?period=week' })}>
      <Header d={P.chart} text={t('w_today')} live={live} link="reports?period=week" />
      <TextWidget text={fmtMin(s.todayMin || 0, t)} maxLines={1} style={{ fontSize: 24, fontWeight: '700', color: W }} />
      <TextWidget text={t('w_week') + ': ' + fmtMin(s.weekMin || 0, t)} maxLines={1} truncate="END" style={{ fontSize: 12, color: MUTED, marginTop: 4 }} />
      {s.artist ? <TextWidget text={t('w_most') + ': ' + s.artist} maxLines={2} truncate="END" style={{ fontSize: 12, color: W, marginTop: 6 }} /> : null}
    </Shell>
  );
}

// ---------- Ярлыки 1×1 ----------
const SHORT = {
  ShortSnippets: { d: P.bolt, k: 'snip_short', link: 'snippets' },
  ShortMix: { d: P.sparkle, k: 'for_you', link: 'mix' },
  ShortSleep: { d: P.moon, k: 'sleep', link: 'sleep?min=30' },
};
function Short({ live, t, kind, w }) {
  const a = SHORT[kind];
  const small = w < 70;
  return (
    <Shell padding={4} {...click(live, { link: a.link })}>
      <FlexWidget {...click(live, { link: a.link })} style={{ width: 'match_parent', height: 'match_parent', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <Icon d={a.d} size={small ? 24 : 28} />
        {!small ? <TextWidget text={t(a.k)} maxLines={1} truncate="END" style={{ fontSize: 10, color: W, marginTop: 3 }} /> : null}
      </FlexWidget>
    </Shell>
  );
}

export const WIDGETS = ['PlayerLarge', 'Cover', 'Actions', 'Playlists', 'TopWeek', 'Stats', 'ShortSnippets', 'ShortMix', 'ShortSleep'];

/** Нарисовать виджет по имени. info — WidgetInfo (ширина и высота в dp). */
export async function renderWidget(name, info) {
  const ctx = await widgetContext();
  const t = (k, p) => translate(ctx.lang, k, p);
  const w = (info && info.width) || 250, h = (info && info.height) || 110;
  const props = { ...ctx, t, w, h };
  switch (name) {
    case 'PlayerLarge': return <PlayerLarge {...props} cover={await coverData(ctx.now.cover)} />;
    case 'Cover': return <Cover {...props} cover={await coverData(ctx.now.cover)} />;
    case 'Actions': return <Actions {...props} />;
    case 'Playlists': return <Playlists {...props} />;
    case 'TopWeek': return <TopWeek {...props} />;
    case 'Stats': return <Stats {...props} />;
    default: return SHORT[name] ? <Short {...props} kind={name} /> : null;
  }
}
