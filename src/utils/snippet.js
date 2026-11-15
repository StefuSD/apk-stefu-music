/**
 * Отрезок песни для режима «Только припевы»: найденный припев (song.chorus,
 * разбор на телефоне или ручной), иначе — 25 секунд с трети песни, где
 * обычно уже идёт основная часть.
 */
export const SNIP_FADE_IN = 1.5;
export const SNIP_FADE_OUT = 2.5;

export function snippetRange(song, dur) {
  const d = dur || (song && song.duration) || 0;
  const c = song && song.chorus;
  if (c && c.end > c.start) {
    const end = Math.min(c.end, c.start + 40, d || Infinity);
    if (end - c.start >= 6) return [c.start, end];
  }
  if (d > 40) { const a = Math.round(d * 0.33); return [a, Math.min(d - 1, a + 25)]; }
  return [0, d || 25];
}
