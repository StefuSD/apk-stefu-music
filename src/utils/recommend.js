/**
 * Похожие песни и «радио по песне».
 *
 * Сходство двух песен — сумма признаков с весами:
 *   • общие теги — главный признак. Вес тега = log(N / число песен с тегом):
 *     редкий тег («колыбельная») сближает сильнее, чем тег у половины
 *     библиотеки («русское»). Это IDF из поиска по текстам;
 *   • общий язык песни, тот же исполнитель, жанр, альбом, близкий год;
 *   • «слушаете вместе»: песню B включали в течение 20 минут после A —
 *     совместные прослушивания из истории (как «с этим слушают» в магазинах);
 *   • чуть-чуть — любимость и частота самой B, чтобы при равенстве
 *     впереди была музыка, которая вам нравится.
 *   • звучание (если с компьютера пришли данные tools/sound.py): близкий
 *     темп (с учётом половинного/двойного), энергия и яркость тембра;
 *   • ручные веса тегов (Настройки → «Веса тегов»): ×0 — тег не учитывать,
 *     ×2/×3 — тег важнее остальных.
 * Кандидатов без единого общего признака не предлагаем.
 */

export const W = {
  tag: 2.0, lang: 1.0, artist: 3.0, genre: 1.5, album: 1.0, year: 0.5, together: 1.2, fav: 0.4, plays: 0.15, sound: 1.6,
};

/** Сходство звучания 0..1: темп (± половинный/двойной), энергия, яркость. null — данных нет. */
export function soundSimilarity(a, b) {
  const x = a && a.sound, y = b && b.sound;
  if (!x || !y) return null;
  let sum = 0, n = 0;
  if (x.bpm && y.bpm) {
    const r = Math.max(x.bpm, y.bpm) / Math.min(x.bpm, y.bpm);
    const d = Math.min(Math.abs(Math.log2(r)), Math.abs(Math.log2(r) - 1));   // 120 и 60 — почти один темп
    sum += Math.max(0, 1 - d / 0.25); n++;
  }
  if (x.energy != null && y.energy != null) { sum += 1 - Math.min(1, Math.abs(x.energy - y.energy) / 0.5); n++; }
  if (x.bright != null && y.bright != null) { sum += 1 - Math.min(1, Math.abs(x.bright - y.bright) / 0.5); n++; }
  return n ? sum / n : null;
}

const norm = s => (s || '').trim().toLowerCase();
import { artistsOf } from './artists';

/** Подготовка: веса тегов и пары «слушали вместе». Пересчитывать при смене библиотеки/истории. */
export function buildIndex(songs, plays, tagWeights = {}) {
  const N = Math.max(1, songs.length);
  const df = {};
  for (const s of songs) for (const t of s.tags || []) df[t] = (df[t] || 0) + 1;
  const idf = {};
  for (const t of Object.keys(df)) idf[t] = Math.log(1 + N / df[t]) * (tagWeights[t] != null ? tagWeights[t] : 1);

  // Совместные прослушивания: соседние засчитанные сеансы с разрывом < 20 мин.
  const together = {};
  const seq = plays.filter(p => p.c).sort((a, b) => a.t - b.t);
  const WINDOW = 20 * 60 * 1000;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length && seq[j].t - seq[i].t < WINDOW; j++) {
      const a = seq[i].s, b = seq[j].s;
      if (a === b) continue;
      (together[a] || (together[a] = {}))[b] = ((together[a] || {})[b] || 0) + 1;
      (together[b] || (together[b] = {}))[a] = ((together[b] || {})[a] || 0) + 1;
    }
  }
  const count = {};
  for (const p of plays) if (p.c) count[p.s] = (count[p.s] || 0) + 1;
  return { idf, together, count };
}

/** Оценка сходства b с a и причины (для подписи «почему»). */
export function similarity(a, b, idx) {
  let score = 0;
  const why = [];
  const bt = new Set(b.tags || []);
  const shared = (a.tags || []).filter(t => bt.has(t) && idx.idf[t] !== 0);
  if (shared.length) {
    score += W.tag * shared.reduce((x, t) => x + (idx.idf[t] ?? 1), 0);
    why.push(...shared);
  }
  const bl = new Set(b.langs || []);
  if ((a.langs || []).some(l => bl.has(l))) score += W.lang;
  const ba = new Set(artistsOf(b).map(norm));
  const common = artistsOf(a).filter(x => ba.has(norm(x)));
  if (common.length) { score += W.artist; why.push(common[0]); }
  if (a.genre && norm(a.genre) === norm(b.genre)) { score += W.genre; why.push(b.genre); }
  if (a.album && norm(a.album) === norm(b.album)) { score += W.album; }
  const ya = parseInt(a.year, 10), yb = parseInt(b.year, 10);
  if (ya && yb && Math.abs(ya - yb) <= 3) score += W.year;
  const tg = (idx.together[a.id] || {})[b.id] || 0;
  if (tg) score += W.together * Math.log2(1 + tg);
  // Звучание: само по себе слабый признак (близкий темп есть у многих), поэтому
  // добавляет очки только при заметном сходстве, а «похожими» делает лишь вместе с другим признаком
  // или при очень близком звуке.
  const ss = soundSimilarity(a, b);
  if (ss != null && ss > 0.6) {
    const add = W.sound * (ss - 0.6) / 0.4;
    if (score > 0 || ss > 0.85) score += add;
  }
  if (score <= 0) return { score: 0, why };
  if (b.fav) score += W.fav;
  score += W.plays * Math.log2(1 + (idx.count[b.id] || 0));
  return { score, why };
}

/** Похожие на песню, лучшие сначала. */
export function similarSongs(song, songs, idx, limit = 20) {
  if (!song) return [];
  const out = [];
  for (const b of songs) {
    if (b.id === song.id) continue;
    const r = similarity(song, b, idx);
    if (r.score > 0) out.push({ song: b, score: r.score, why: r.why });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, limit);
}

/**
 * Радио: начинаем с песни и каждый раз берём следующую, похожую на
 * последние три (свежая важнее), не повторяясь. Немного случайности —
 * чтобы радио по одной песне не было каждый раз одинаковым. Когда похожих
 * не осталось — добавляем случайные из любимых и частых.
 */
export function radioQueue(seed, songs, idx, length = 40) {
  const used = new Set([seed.id]);
  const q = [seed];
  const byId = {};
  for (const s of songs) byId[s.id] = s;
  while (q.length < length) {
    const recent = q.slice(-3).reverse();
    let best = null, bestScore = 0;
    for (const b of songs) {
      if (used.has(b.id)) continue;
      let sc = 0;
      recent.forEach((a, k) => { sc += similarity(a, b, idx).score * [1, 0.6, 0.35][k]; });
      if (sc <= 0) continue;
      sc *= 0.8 + Math.random() * 0.4;
      if (sc > bestScore) { bestScore = sc; best = b; }
    }
    if (!best) {
      const rest = songs.filter(s => !used.has(s.id));
      if (!rest.length) break;
      rest.sort((x, y) => (Number(!!y.fav) - Number(!!x.fav)) || ((idx.count[y.id] || 0) - (idx.count[x.id] || 0)) || (Math.random() - 0.5));
      best = rest[Math.floor(Math.random() * Math.min(rest.length, 10))];
    }
    used.add(best.id);
    q.push(best);
  }
  return q.map(s => s.id);
}
