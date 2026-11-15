// Ссылки в приложение — от Stefu Assistant, ярлыков и других программ.
//
// Схема — сам applicationId (как у Stefu Contacts): com.stefu.music://…,
// у сборки для съёмки — com.stefu.music.shots://… (plugins/withLinks.js).
// Так ссылка из основного ассистента не открывает «Music Shots».
//
//   play?q=&title=&artist=&album=&genre=&tag=&lang=&fav=1&shuffle=1
//                       найти песни и играть; без условий — играть всё
//   favorites[?shuffle=1]     играть избранное
//   shuffle             играть всё вперемешку (с условиями — их вперемешку)
//   mix                 «Микс для вас»
//   radio?q=…           радио по песне (похожие на найденную)
//   search?q=…          открыть библиотеку с поиском, ничего не включая
//                       (можно и tag=/lang=/fav=1 — фильтр)
//   pause | resume | toggle | next | prev | stop     управление плеером
//   player | library | settings                      открыть экран
//   reports[?period=week|month|year|all]             отчёты
//   top[?period=…]                                   вкладка «Топ-20»
//   playlist?name=…[&shuffle=1]                      играть плейлист (имя без учёта регистра;
//                       можно и часть имени); без имени — открыть библиотеку
//   sleep?min=30 | sleep?min=end | sleep?min=off     таймер сна (минуты, после песни, выключить)
//   snippets[?q=…&tag=…&fav=1…]   «Только припевы»: найденные песни (или незнакомые, если условий нет)
//                       вперемешку, по припеву каждой
//
// Значения — UTF-8 в %-кодировке, «+» — пробел. Незнакомые параметры и
// пустые значения пропускаются, ненормальные значения (period=foo) — тоже.

export const SCHEME_PREFIX = 'com.stefu.music';

const ACTIONS = new Set([
  'play', 'favorites', 'shuffle', 'mix', 'radio', 'search',
  'pause', 'resume', 'toggle', 'next', 'prev', 'stop',
  'player', 'library', 'settings', 'reports', 'top', 'playlist', 'sleep', 'snippets',
]);
const ALIASES = {
  fav: 'favorites', favourites: 'favorites', previous: 'prev', back: 'prev', skip: 'next',
  open: 'library', music: 'library', home: 'library', report: 'reports', stats: 'reports',
  similar: 'radio', find: 'search', play_pause: 'toggle', playpause: 'toggle',
  pl: 'playlist', list: 'playlist', timer: 'sleep', top20: 'top', chart: 'top',
  snippet: 'snippets', chorus: 'snippets', choruses: 'snippets', preview: 'snippets',
};
const PERIODS = new Set(['week', 'month', 'year', 'all']);
const PERIOD_ALIASES = { '7': 'week', d7: 'week', '30': 'month', d30: 'month', '365': 'year', alltime: 'all' };
const TEXT_KEYS = ['q', 'title', 'artist', 'album', 'genre', 'tag'];
const MAX_LEN = 200;

function decode(s) {
  try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { return s.replace(/\+/g, ' '); }
}

const truthy = v => /^(1|true|yes|on|да)$/i.test((v || '').trim());

/** Разбор строки запроса: { ключ: значение } (последнее значение побеждает). */
export function parseQuery(qs) {
  const out = {};
  for (const part of (qs || '').split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = decode(eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase();
    const v = eq < 0 ? '' : decode(part.slice(eq + 1));
    if (k) out[k] = v;
  }
  return out;
}

/**
 * Ссылка → { action, q, title, artist, album, genre, tag, lang, fav, shuffle, period }
 * или null, если ссылка не наша / действие неизвестно.
 */
export function parseLink(url) {
  if (typeof url !== 'string') return null;
  const m = url.trim().match(/^([a-z][a-z0-9+.-]*):\/\/([^?#]*)(?:\?([^#]*))?/i);
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  if (scheme !== SCHEME_PREFIX && !scheme.startsWith(SCHEME_PREFIX + '.')) return null;
  const path = decode(m[2]).replace(/^\/+|\/+$/g, '').toLowerCase();
  let [name, ...rest] = path.split('/');
  name = ALIASES[name] || name || 'library';
  if (!ACTIONS.has(name)) return null;
  const p = parseQuery(m[3]);
  const a = { action: name };
  // play/<текст> и search/<текст> — то же, что ?q=
  if (rest.length && !p.q) p.q = decode(m[2]).replace(/^\/+|\/+$/g, '').split('/').slice(1).join('/');
  for (const k of TEXT_KEYS) {
    const v = (p[k] || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    if (v) a[k] = v;
  }
  if (p.lang) { const l = normLang(p.lang); if (l) a.lang = l; }
  if (truthy(p.fav)) a.fav = true;
  if (truthy(p.shuffle)) a.shuffle = true;
  if (name === 'favorites') { a.action = 'play'; a.fav = true; }
  if (name === 'shuffle') { a.action = 'play'; a.shuffle = true; }
  if (name === 'playlist') {
    const v = (p.name || p.q || '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
    delete a.q;
    if (v) a.name = v;
  }
  if (name === 'sleep') {
    const v = (p.min || p.minutes || p.q || '').trim().toLowerCase();
    if (/^(end|song|после|конец)/.test(v)) a.min = 'end';
    else if (/^(0|off|no|нет|выкл)/.test(v)) a.min = 0;
    else if (Number(v) > 0 && Number(v) <= 600) a.min = Math.round(Number(v));
    else return null;
  }
  if ((name === 'reports' || name === 'top') && p.period) {
    const per = PERIOD_ALIASES[p.period.trim().toLowerCase()] || p.period.trim().toLowerCase();
    if (PERIODS.has(per)) a.period = per;
  }
  return a;
}

// ---- языки ----

const LANG_STEMS = [
  ['ru', ['ru', 'russian', 'рус']], ['en', ['en', 'english', 'англ']], ['uk', ['uk', 'ua', 'ukrainian', 'укр']],
  ['es', ['es', 'spanish', 'испан']], ['fr', ['fr', 'french', 'франц', 'француз']], ['de', ['de', 'german', 'немец', 'немецк']],
  ['it', ['it', 'italian', 'итал']], ['pt', ['pt', 'portuguese', 'португ']], ['pl', ['pl', 'polish', 'польск']],
  ['tr', ['tr', 'turkish', 'турец', 'турецк']], ['ro', ['ro', 'romanian', 'румын']], ['ko', ['ko', 'korean', 'корей']],
  ['ja', ['ja', 'japanese', 'япон']], ['ar', ['ar', 'arabic', 'араб']], ['none', ['none', 'instrumental', 'без слов', 'инструм']],
];

/** «английский», «на английском», «English», «en» → 'en'; иначе — само слово (свой язык). */
export function normLang(text) {
  let s = norm(text).replace(/^на\s+/, '');
  if (!s) return '';
  for (const [code, stems] of LANG_STEMS) {
    if (stems.some(st => (st.length <= 2 ? s === st : s.startsWith(st)))) return code;
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- поиск песен ----

/** Нижний регистр, ё → е, без знаков препинания. */
export function norm(s) {
  return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const words = s => norm(s).split(' ').filter(Boolean);

/**
 * Слово запроса подходит к слову поля: начало слова («земф» → «земфира»)
 * или то же слово в другом падеже («цоя» → «цой», «земфиру» → «земфира»).
 */
export function wordMatch(q, f) {
  if (q.length === 1) return q === f;
  if (f.startsWith(q)) return true;
  let p = 0;
  while (p < q.length && p < f.length && q[p] === f[p]) p++;
  const min = Math.min(q.length, f.length);
  return p >= 2 && p >= min - (min >= 6 ? 2 : 1) && q.length - p <= 2 && f.length - p <= 2;
}

/** Совпадает ли поле со словами запроса (каждое слово запроса есть в поле). */
function fieldMatch(field, qWords) {
  const fw = words(field);
  if (!fw.length || !qWords.length) return false;
  return qWords.every(q => fw.some(f => wordMatch(q, f)));
}

const artistList = s => (s.artists && s.artists.length ? s.artists : (s.artist ? [s.artist] : []));

/** Насколько песня подходит к свободному тексту q (0 — не подходит). */
export function scoreSong(s, q, uiLangName) {
  const nq = norm(q);
  if (!nq) return 1;
  const qw = nq.split(' ');
  const title = norm(s.title);
  if (title && title === nq) return 100;
  const arts = artistList(s);
  if (arts.some(a => norm(a) === nq)) return 90;
  // «Кино Группа крови»: исполнитель + название вместе.
  const all = [s.title, ...arts, s.album, s.genre, ...(s.tags || []), ...(s.langs || []).map(l => (uiLangName ? uiLangName(l) : l))].join(' ');
  if (title && nq.includes(title) && title.length >= 3 && fieldMatch(all, qw)) return 95;
  if (fieldMatch(s.title, qw)) return 70;
  if (arts.some(a => fieldMatch(a, qw))) return 60;
  if ((s.tags || []).some(t => fieldMatch(t, qw)) || fieldMatch(s.genre, qw)) return 50;
  if (fieldMatch(s.album, qw)) return 40;
  if (fieldMatch(all, qw)) return 20;
  return 0;
}

/**
 * Песни по условиям ссылки, лучшие совпадения первыми.
 * opts: { playCount, uiLangName }. Возвращает массив песен.
 */
export function pickSongs(a, songs, opts = {}) {
  const pc = opts.playCount || {};
  const has = (f, v) => !v || fieldMatch(f, words(v));
  const out = [];
  for (const s of songs || []) {
    if (a.fav && !s.fav) continue;
    if (a.lang && !(s.langs || []).some(l => l.toLowerCase() === a.lang.toLowerCase())) continue;
    if (a.tag && !(s.tags || []).some(t => norm(t) === norm(a.tag) || fieldMatch(t, words(a.tag)))) continue;
    if (!has(s.title, a.title) || !has(s.album, a.album) || !has(s.genre, a.genre)) continue;
    if (a.artist && !artistList(s).some(x => fieldMatch(x, words(a.artist)))) continue;
    const sc = a.q ? scoreSong(s, a.q, opts.uiLangName) : 1;
    if (!sc) continue;
    out.push({ s, sc });
  }
  // Точные совпадения названия: с ним играть одну эту песню первой.
  out.sort((x, y) => y.sc - x.sc || (pc[y.s.id] || 0) - (pc[x.s.id] || 0) || (y.s.addedAt || 0) - (x.s.addedAt || 0));
  return out.map(x => x.s);
}

/** Есть ли в ссылке условия отбора песен. */
export const hasFilter = a => !!(a.q || a.title || a.artist || a.album || a.genre || a.tag || a.lang || a.fav);
