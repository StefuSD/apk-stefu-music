export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

export function fmtSize(b) {
  if (!b) return '0 MB';
  if (b >= 1024 ** 3) return (b / 1024 ** 3).toFixed(1) + ' GB';
  return (b / 1024 ** 2).toFixed(b >= 100 * 1024 ** 2 ? 0 : 1) + ' MB';
}

/** Длительность прослушивания словами: «42 мин», «3 ч 05 мин». */
export function fmtListen(sec, t) {
  const m = Math.round((sec || 0) / 60);
  if (m < 60) return t('r_minutes', { n: m });
  return t('r_hours', { h: Math.floor(m / 60), m: String(m % 60).padStart(2, '0') });
}

export function fmtDate(ts, lang) {
  try { return new Date(ts).toLocaleDateString(lang || 'en', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch (e) { return new Date(ts).toISOString().slice(0, 10); }
}

export const dayKey = (ts) => {
  const d = new Date(ts);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
