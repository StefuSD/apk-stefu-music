import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// Теги — метки, а не украшение: один спокойный тон для всех.
export function tagColor(colors) {
  return colors.mode === 'night' ? '#a3a1a6' : '#6d6b70';
}

const ThemeContext = createContext({ colors: LIGHT, toggle: () => {}, isDark: false });

export function ThemeProvider({ children }) {
  const [colors, setColors] = useState(LIGHT);
  useEffect(() => {
    AsyncStorage.getItem('sm_theme').then(s => { if (s === 'night') setColors(DARK); });
  }, []);
  const value = useMemo(() => ({
    colors,
    isDark: colors.mode === 'night',
    toggle: () => {
      const next = colors.mode === 'light' ? DARK : LIGHT;
      setColors(next);
      AsyncStorage.setItem('sm_theme', next.mode);
    },
  }), [colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
