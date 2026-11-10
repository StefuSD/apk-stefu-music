// Языки песен. В песне хранится список кодов (['ru', 'en']); свой язык,
// которого нет в списке, хранится как есть — своим названием.
export const SONG_LANGS = [
  { code: 'ru', ru: 'Русский', en: 'Russian' },
  { code: 'en', ru: 'Английский', en: 'English' },
  { code: 'uk', ru: 'Украинский', en: 'Ukrainian' },
  { code: 'es', ru: 'Испанский', en: 'Spanish' },
  { code: 'fr', ru: 'Французский', en: 'French' },
  { code: 'de', ru: 'Немецкий', en: 'German' },
  { code: 'it', ru: 'Итальянский', en: 'Italian' },
  { code: 'pt', ru: 'Португальский', en: 'Portuguese' },
  { code: 'pl', ru: 'Польский', en: 'Polish' },
  { code: 'tr', ru: 'Турецкий', en: 'Turkish' },
  { code: 'ro', ru: 'Румынский', en: 'Romanian' },
  { code: 'ko', ru: 'Корейский', en: 'Korean' },
  { code: 'ja', ru: 'Японский', en: 'Japanese' },
  { code: 'ar', ru: 'Арабский', en: 'Arabic' },
  { code: 'none', ru: 'Без слов', en: 'Instrumental' },
];

const BY_CODE = {};
for (const l of SONG_LANGS) BY_CODE[l.code] = l;

/** Название языка на языке интерфейса; свой язык — как записан. */
export function langName(code, uiLang) {
  const l = BY_CODE[code];
  return l ? (l[uiLang] || l.en) : code;
}

/** Нормализовать введённое: «english», «Английский» → 'en'; иначе — само слово. */
export function toLangCode(text) {
  const s = (text || '').trim();
  if (!s) return '';
  const low = s.toLowerCase();
  const hit = SONG_LANGS.find(l => l.code === low || l.ru.toLowerCase() === low || l.en.toLowerCase() === low);
  return hit ? hit.code : s.charAt(0).toUpperCase() + s.slice(1);
}

/** Ссылка на видео: добавляем https://, если её вставили без протокола. */
export function normalizeUrl(u) {
  const s = (u || '').trim();
  if (!s) return '';
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : 'https://' + s;
}
