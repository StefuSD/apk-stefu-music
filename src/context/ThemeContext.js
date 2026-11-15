import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_THEME_SPECS, makeAppTheme } from '../data/appThemes';

// Палитра Stefu Music — нейтральная: графит, тёплый серый и белый.
// Цвета почти нет: главное — обложки и музыка. Фиолетовый остался только
// в иконке приложения.
const INK = '#18171a';         // графит: шапка, плеер, выбранные кнопки, заглушки обложек
const ACCENT = '#2e2c31';      // кнопки действия и играющая песня (белый на нём ~14:1)
const MIST = '#d4d2d6';        // светло-серый: активные значки и полосы в плеере
const NIGHT = '#111012';

export const LIGHT = {
  mode: 'light',
  bg: '#f5f5f4',
  bgHeader: INK,
  // шапка: та же схема, что у «Сирени» — три радиальных свечения, только графитовые
  headerGlow: [
    { cx: 88, cy: 0, r: 75, color: '#7a7880', o: 0.8 },     // светлый графит сверху справа
    { cx: 0, cy: 100, r: 85, color: '#4a4850', o: 0.75 },   // графит снизу слева
    { cx: 55, cy: 125, r: 60, color: '#5c6170', o: 0.6 },   // холодный серый снизу
  ],
  bgCard: '#ffffff',
  bgInput: '#efeeed',
  bgSubtle: '#f8f8f7',
  border: '#e4e3e1',
  text: '#161517',
  textMuted: '#7a787d',
  accent: ACCENT,
  accentSoft: '#ebeae8',
  danger: '#a34a43',
  success: '#3d7a55',
  tabBar: '#ffffff',
  tabActive: INK,
  tabInact: '#aeacb0',
  headerText: '#f3f2f1',
  navBar: INK,
  headerBtn: 'rgba(255,255,255,0.10)',
  onAccent: '#ffffff',
  overlay: 'rgba(12,12,13,0.55)',
  player: INK,
  playerSoft: MIST,
  ink: INK,
  onInk: '#f3f2f1',
  // Мини-плеер внизу — голубой с белым: единственное цветное пятно в
  // нейтральном интерфейсе, сразу видно, что играет. Белый на нём ~4.8:1.
  miniTop: '#2f8fe6',
  miniBottom: '#2f8fe6',
  miniText: '#ffffff',
  miniSub: 'rgba(255,255,255,0.82)',
  miniTrack: 'rgba(255,255,255,0.28)',
  miniBar: '#ffffff',
  miniEdge: '#2580d4',
};

export const DARK = {
  mode: 'night',
  bg: '#080809',
  bgHeader: NIGHT,
  bgCard: NIGHT,
  bgInput: '#1c1b1e',
  bgSubtle: '#0e0e0f',
  border: '#272629',
  text: '#ecebea',
  textMuted: '#8c8a8f',
  accent: '#e6e4e2',
  accentSoft: '#1f1e21',
  danger: '#d48a84',
  success: '#86c29d',
  tabBar: NIGHT,
  tabActive: '#ecebea',
  tabInact: '#68666b',
  headerText: '#ecebea',
  navBar: NIGHT,
  headerBtn: 'rgba(255,255,255,0.08)',
  onAccent: '#080809',
  overlay: 'rgba(0,0,0,0.7)',
  player: '#0d0d0e',
  playerSoft: MIST,
  ink: '#2a292c',
  onInk: '#ecebea',
  // В тёмной теме голубой глубже, чтобы не слепил ночью.
  miniTop: '#14315e',
  miniBottom: '#14315e',
  miniText: '#ffffff',
  miniSub: 'rgba(255,255,255,0.78)',
  miniTrack: 'rgba(255,255,255,0.22)',
  miniBar: '#ffffff',
  miniEdge: '#0f2649',
};

// «Сирень»: светлые страницы, шапка — тёмно-фиолетовая основа с радиальными свечениями
// (src/components/HeaderBg.js), кнопки и выделения — сиреневые вместо графитовых,
// кнопки действия — сине-фиолетовые, удаление — малиновое.
const LILAC_BTN = '#8a4fd6';   // сиреневый: выбранные кнопки, плавающие кнопки, активная вкладка (белый ~5:1)
export const LILAC = {
  ...LIGHT,
  mode: 'lilac',
  bg: '#f6f2fb',
  bgHeader: '#3a1466',
  headerGlow: [
    { cx: 88, cy: 0, r: 75, color: '#c9a2ff', o: 0.85 },    // сиреневое сверху справа
    { cx: 0, cy: 100, r: 85, color: '#c026d3', o: 0.75 },   // пурпурное снизу слева
    { cx: 55, cy: 125, r: 60, color: '#4f46e5', o: 0.6 },   // синеватое снизу
  ],
  bgCard: '#ffffff',
  bgInput: '#efe7f8',
  bgSubtle: '#faf7fd',
  border: '#e6dcf2',
  text: '#1f1430',
  textMuted: '#76688a',
  accent: '#5b3fd1',
  accentSoft: '#efe6fb',
  danger: '#c2416b',
  tabBar: '#ffffff',
  tabActive: LILAC_BTN,
  tabInact: '#b4a8c4',
  headerText: '#ffffff',
  navBar: '#2c0f4f',
  headerBtn: 'rgba(255,255,255,0.16)',
  player: '#2a1146',
  playerSoft: '#dcc8fb',
  ink: LILAC_BTN,
  onInk: '#ffffff',
};

DARK.dark = true;
// тёмная тема: шапка сплошная, а для картинки итогов — мягкий градиент того же рисунка
DARK.cardGlow = [
  { cx: 88, cy: 0, r: 75, color: '#4a4850', o: 0.8 },
  { cx: 0, cy: 100, r: 85, color: '#2c2b30', o: 0.75 },
  { cx: 55, cy: 125, r: 60, color: '#3a3f4e', o: 0.6 },
];

// Тематические оформления (Новый год, Хэллоуин, Космос …) — src/data/appThemes.js
export const APP_THEMES = APP_THEME_SPECS.map(s => makeAppTheme(s, s.dark ? DARK : LIGHT));
const MODES = { light: LIGHT, night: DARK, lilac: LILAC, ...Object.fromEntries(APP_THEMES.map(x => [x.mode, x])) };

// Теги — метки, а не украшение: один спокойный тон для всех.
export function tagColor(colors) {
  return colors.dark ? '#a3a1a6' : '#6d6b70';
}

const ThemeContext = createContext({ colors: LILAC, toggle: () => {}, setMode: () => {}, isDark: false });

export function ThemeProvider({ children }) {
  const [colors, setColors] = useState(LILAC);   // «Сирень» — тема по умолчанию; выбранная пользователем читается ниже
  useEffect(() => {
    AsyncStorage.getItem('sm_theme').then(s => { if (MODES[s]) setColors(MODES[s]); });
  }, []);
  const value = useMemo(() => ({
    colors,
    isDark: !!colors.dark,
    // тема по имени: 'light' | 'night' | 'lilac' | id тематического оформления
    setMode: (mode) => {
      const next = MODES[mode] || LILAC;
      setColors(next);
      AsyncStorage.setItem('sm_theme', next.mode);
    },
    toggle: () => {
      const next = colors.mode === 'night' ? LIGHT : DARK;
      setColors(next);
      AsyncStorage.setItem('sm_theme', next.mode);
    },
  }), [colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
