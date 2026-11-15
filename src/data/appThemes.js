// Тематические оформления приложения (не путать с темами фона обложек в data/themes.js).
// Каждая тема — светлая или тёмная основа плюс свои цвета: шапка (основа + радиальные свечения
// + мелкий декор, src/components/HeaderBg.js), кнопки и выделения (ink), кнопки действия (accent),
// фон страниц, плеер и нижняя панель телефона.
// decor: snow | stars | confetti | hearts | petals | leaves | bubbles | none.
// Названия — на всех 19 языках интерфейса; нет перевода — английское.

const N = (ru, en, uk, ro, es, it, de, pt, pl, tr, fr, nl, cs, hu, sv, el, bg, hr, lt) =>
  ({ ru, en, uk, ro, es, it, de, pt, pl, tr, fr, nl, cs, hu, sv, el, bg, hr, lt });

export const APP_THEME_SPECS = [
  {
    id: 'new_year', decor: 'snow', dark: false,
    name: N('Новый год', 'New Year', 'Новий рік', 'Anul Nou', 'Año Nuevo', 'Capodanno', 'Neujahr', 'Ano Novo', 'Nowy Rok', 'Yılbaşı', 'Nouvel An', 'Nieuwjaar', 'Nový rok', 'Újév', 'Nyår', 'Πρωτοχρονιά', 'Нова година', 'Nova godina', 'Naujieji metai'),
    header: '#0b1d3a', glow: [['#d4af37', 0.75], ['#c0392b', 0.6], ['#5aa0e6', 0.55]],
    bg: '#f3f6fb', ink: '#c0392b', accent: '#1d3f7a', tint: '#e8eef8',
  },
  {
    id: 'christmas', decor: 'snow', dark: false,
    name: N('Рождество', 'Christmas', 'Різдво', 'Crăciun', 'Navidad', 'Natale', 'Weihnachten', 'Natal', 'Boże Narodzenie', 'Noel', 'Noël', 'Kerstmis', 'Vánoce', 'Karácsony', 'Jul', 'Χριστούγεννα', 'Коледа', 'Božić', 'Kalėdos'),
    header: '#0f3d2e', glow: [['#c0392b', 0.7], ['#f5d76e', 0.6], ['#2e8b57', 0.6]],
    bg: '#f3f8f4', ink: '#1f7a4d', accent: '#b03027', tint: '#e5f1e9',
  },
  {
    id: 'halloween', decor: 'stars', dark: true,
    name: N('Хэллоуин', 'Halloween', 'Гелловін', 'Halloween', 'Halloween', 'Halloween', 'Halloween', 'Halloween', 'Halloween', 'Cadılar Bayramı', 'Halloween', 'Halloween', 'Halloween', 'Halloween', 'Halloween', 'Χάλοουιν', 'Хелоуин', 'Noć vještica', 'Helovinas'),
    header: '#1a0d24', glow: [['#ff7518', 0.8], ['#5b2a86', 0.75], ['#9d4edd', 0.45]],
    bg: '#0e0912', card: '#1a1220', ink: '#ff7518', onInk: '#1a0d24', accent: '#ff9a3c', onAccent: '#1a0d24', tint: '#2a1a33',
  },
  {
    id: 'valentine', decor: 'hearts', dark: false,
    name: N('День влюблённых', 'Valentine’s Day', 'День закоханих', 'Ziua Îndrăgostiților', 'San Valentín', 'San Valentino', 'Valentinstag', 'Dia dos Namorados', 'Walentynki', 'Sevgililer Günü', 'Saint-Valentin', 'Valentijnsdag', 'Valentýn', 'Valentin-nap', 'Alla hjärtans dag', 'Άγιος Βαλεντίνος', 'Свети Валентин', 'Valentinovo', 'Valentino diena'),
    header: '#4a0d1f', glow: [['#e63462', 0.8], ['#ff8fab', 0.65], ['#b5179e', 0.5]],
    bg: '#fdf2f5', ink: '#d6336c', accent: '#a3204f', tint: '#fbe3ea',
  },
  {
    id: 'spring', decor: 'petals', dark: false,
    name: N('Весна', 'Spring', 'Весна', 'Primăvară', 'Primavera', 'Primavera', 'Frühling', 'Primavera', 'Wiosna', 'İlkbahar', 'Printemps', 'Lente', 'Jaro', 'Tavasz', 'Vår', 'Άνοιξη', 'Пролет', 'Proljeće', 'Pavasaris'),
    header: '#2f6b3a', glow: [['#b9e3a3', 0.7], ['#ffd6e0', 0.6], ['#ffe08a', 0.5]],
    bg: '#f4faf3', ink: '#2f8043', accent: '#c04a77', tint: '#e4f2e1',
  },
  {
    id: 'sakura', decor: 'petals', dark: false,
    name: N('Сакура', 'Sakura', 'Сакура', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Sakura', 'Szakura', 'Sakura', 'Σακούρα', 'Сакура', 'Sakura', 'Sakura'),
    header: '#5c2a44', glow: [['#ffb7c5', 0.8], ['#ffe5ec', 0.55], ['#c77dff', 0.4]],
    bg: '#fdf5f8', ink: '#c04a77', accent: '#7a3b5d', tint: '#f9e4ec',
  },
  {
    id: 'summer', decor: 'bubbles', dark: false,
    name: N('Лето', 'Summer', 'Літо', 'Vară', 'Verano', 'Estate', 'Sommer', 'Verão', 'Lato', 'Yaz', 'Été', 'Zomer', 'Léto', 'Nyár', 'Sommar', 'Καλοκαίρι', 'Лято', 'Ljeto', 'Vasara'),
    header: '#0b4f6c', glow: [['#ffd166', 0.8], ['#06d6a0', 0.6], ['#ef476f', 0.4]],
    bg: '#f2fafc', ink: '#0f7ea3', accent: '#bf4a2f', tint: '#e0f2f7',
  },
  {
    id: 'ocean', decor: 'bubbles', dark: false,
    name: N('Океан', 'Ocean', 'Океан', 'Ocean', 'Océano', 'Oceano', 'Ozean', 'Oceano', 'Ocean', 'Okyanus', 'Océan', 'Oceaan', 'Oceán', 'Óceán', 'Hav', 'Ωκεανός', 'Океан', 'Ocean', 'Vandenynas'),
    header: '#03305c', glow: [['#00b4d8', 0.75], ['#90e0ef', 0.55], ['#0353a4', 0.6]],
    bg: '#f0f7fb', ink: '#0077b6', accent: '#025f8f', tint: '#dff0f8',
  },
  {
    id: 'autumn', decor: 'leaves', dark: false,
    name: N('Осень', 'Autumn', 'Осінь', 'Toamnă', 'Otoño', 'Autunno', 'Herbst', 'Outono', 'Jesień', 'Sonbahar', 'Automne', 'Herfst', 'Podzim', 'Ősz', 'Höst', 'Φθινόπωρο', 'Есен', 'Jesen', 'Ruduo'),
    header: '#4a2310', glow: [['#e8740c', 0.8], ['#c0392b', 0.55], ['#f2a541', 0.55]],
    bg: '#fbf6f0', ink: '#b5561a', accent: '#8c3b12', tint: '#f6e7d8',
  },
  {
    id: 'winter', decor: 'snow', dark: false,
    name: N('Зима', 'Winter', 'Зима', 'Iarnă', 'Invierno', 'Inverno', 'Winter', 'Inverno', 'Zima', 'Kış', 'Hiver', 'Winter', 'Zima', 'Tél', 'Vinter', 'Χειμώνας', 'Зима', 'Zima', 'Žiema'),
    header: '#1b3a5c', glow: [['#98c1d9', 0.75], ['#e0fbfc', 0.5], ['#5e7ce2', 0.45]],
    bg: '#f2f6fa', ink: '#3d6e9e', accent: '#27507a', tint: '#e2ebf4',
  },
  {
    id: 'sunset', decor: 'none', dark: false,
    name: N('Закат', 'Sunset', 'Захід сонця', 'Apus', 'Atardecer', 'Tramonto', 'Sonnenuntergang', 'Pôr do sol', 'Zachód słońca', 'Gün batımı', 'Coucher de soleil', 'Zonsondergang', 'Západ slunce', 'Naplemente', 'Solnedgång', 'Ηλιοβασίλεμα', 'Залез', 'Zalazak sunca', 'Saulėlydis'),
    header: '#3d1442', glow: [['#ff7b54', 0.85], ['#ffb26b', 0.6], ['#d1416a', 0.6]],
    bg: '#fdf4f1', ink: '#c94e2c', accent: '#8e2f5e', tint: '#fbe6de',
  },
  {
    id: 'space', decor: 'stars', dark: true,
    name: N('Космос', 'Space', 'Космос', 'Spațiu', 'Espacio', 'Spazio', 'Weltraum', 'Espaço', 'Kosmos', 'Uzay', 'Espace', 'Ruimte', 'Vesmír', 'Űr', 'Rymden', 'Διάστημα', 'Космос', 'Svemir', 'Kosmosas'),
    header: '#070b1f', glow: [['#4f46e5', 0.75], ['#9d4edd', 0.6], ['#00b4d8', 0.35]],
    bg: '#07080f', card: '#11131f', ink: '#6656dc', onInk: '#ffffff', accent: '#a99cff', onAccent: '#07080f', tint: '#1b1d33',
  },
  {
    id: 'party', decor: 'confetti', dark: true,
    name: N('Вечеринка', 'Party', 'Вечірка', 'Petrecere', 'Fiesta', 'Festa', 'Party', 'Festa', 'Impreza', 'Parti', 'Fête', 'Feest', 'Večírek', 'Buli', 'Fest', 'Πάρτι', 'Парти', 'Zabava', 'Vakarėlis'),
    header: '#12052b', glow: [['#f72585', 0.75], ['#4cc9f0', 0.6], ['#7209b7', 0.7]],
    bg: '#0b0614', card: '#170d26', ink: '#d81470', onInk: '#ffffff', accent: '#ff5ca8', onAccent: '#0b0614', tint: '#24143a',
  },
  {
    id: 'forest', decor: 'leaves', dark: false,
    name: N('Лес', 'Forest', 'Ліс', 'Pădure', 'Bosque', 'Foresta', 'Wald', 'Floresta', 'Las', 'Orman', 'Forêt', 'Bos', 'Les', 'Erdő', 'Skog', 'Δάσος', 'Гора', 'Šuma', 'Miškas'),
    header: '#14301f', glow: [['#2d6a4f', 0.8], ['#95d5b2', 0.5], ['#b7a33a', 0.4]],
    bg: '#f3f7f4', ink: '#2d6a4f', accent: '#1b4332', tint: '#e2eee6',
  },
  {
    id: 'coffee', decor: 'none', dark: false,
    name: N('Кофе', 'Coffee', 'Кава', 'Cafea', 'Café', 'Caffè', 'Kaffee', 'Café', 'Kawa', 'Kahve', 'Café', 'Koffie', 'Káva', 'Kávé', 'Kaffe', 'Καφές', 'Кафе', 'Kava', 'Kava'),
    header: '#3b2417', glow: [['#a0612b', 0.7], ['#e8c39e', 0.5], ['#6f4426', 0.6]],
    bg: '#faf6f1', ink: '#8a5a35', accent: '#5e3b22', tint: '#f1e6da',
  },
  {
    id: 'birthday', decor: 'confetti', dark: false,
    name: N('День рождения', 'Birthday', 'День народження', 'Zi de naștere', 'Cumpleaños', 'Compleanno', 'Geburtstag', 'Aniversário', 'Urodziny', 'Doğum günü', 'Anniversaire', 'Verjaardag', 'Narozeniny', 'Születésnap', 'Födelsedag', 'Γενέθλια', 'Рожден ден', 'Rođendan', 'Gimtadienis'),
    header: '#2a1b4a', glow: [['#ff5d8f', 0.75], ['#ffd23f', 0.6], ['#3bceac', 0.55]],
    bg: '#fbf7fd', ink: '#d43a6f', accent: '#5a3fb0', tint: '#f3e8f6',
  },
];

// Где горят свечения в шапке: сверху справа, снизу слева, снизу посередине (координаты 0–100).
const GLOW_SPOTS = [{ cx: 88, cy: 0, r: 75 }, { cx: 0, cy: 100, r: 85 }, { cx: 55, cy: 125, r: 60 }];

const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (x, s) => (x >> s) & 255;
  const c = s => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * k);
  return '#' + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
};

/** Палитра темы из описания: base — LIGHT или DARK из ThemeContext. */
export function makeAppTheme(spec, base) {
  const dark = !!spec.dark;
  return {
    ...base,
    mode: spec.id,
    dark,
    decor: spec.decor,
    bg: spec.bg,
    bgHeader: spec.header,
    headerGlow: spec.glow.map(([color, o], i) => ({ ...GLOW_SPOTS[i], color, o })),
    bgCard: spec.card || '#ffffff',
    bgInput: dark ? mix(spec.card, '#ffffff', 0.06) : mix(spec.bg, spec.ink, 0.07),
    bgSubtle: dark ? mix(spec.bg, '#ffffff', 0.03) : mix(spec.bg, '#ffffff', 0.5),
    border: dark ? mix(spec.card, '#ffffff', 0.12) : mix(spec.bg, spec.ink, 0.14),
    text: dark ? '#efeaf3' : mix('#161517', spec.header, 0.25),
    textMuted: dark ? '#9a92a3' : mix('#7a787d', spec.header, 0.25),
    accent: spec.accent,
    onAccent: spec.onAccent || '#ffffff',
    accentSoft: spec.tint,
    tabBar: dark ? spec.card : '#ffffff',
    tabActive: dark ? spec.accent : spec.ink,     // на тёмной панели — светлый акцент, иначе не видно
    tabInact: dark ? '#6f6878' : mix('#aeacb0', spec.ink, 0.15),
    headerText: '#ffffff',
    headerBtn: 'rgba(255,255,255,0.16)',
    navBar: mix(spec.header, '#000000', 0.25),
    player: mix(spec.header, '#000000', 0.2),
    ink: spec.ink,
    onInk: spec.onInk || '#ffffff',
  };
}

/** Название темы на языке интерфейса. */
export const appThemeName = (spec, lang) => spec.name[lang] || spec.name.en;
