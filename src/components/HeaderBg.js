import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/**
 * Фон шапки: у темы с colors.headerGlow — радиальные свечения поверх основы bgHeader
 * (тема «Сирень»: сиреневое сверху справа, пурпурное снизу слева, синеватое снизу).
 * У светлой и тёмной темы ничего не рисует — шапка остаётся сплошной.
 * Ставится первым ребёнком шапки: лежит под содержимым и не влияет на раскладку.
 */
export default function HeaderBg() {
  const { colors } = useTheme();
  const glow = colors.headerGlow;
  if (!glow) return null;
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
      <Defs>
        {glow.map((g, i) => (
          <RadialGradient key={i} id={`hg${i}`} cx={g.cx} cy={g.cy} r={g.r} fx={g.cx} fy={g.cy} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={g.color} stopOpacity={g.o} />
            <Stop offset="0.55" stopColor={g.color} stopOpacity={g.o * 0.45} />
            <Stop offset="1" stopColor={g.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={colors.bgHeader} />
      {glow.map((g, i) => <Rect key={i} x="0" y="0" width="100" height="100" fill={`url(#hg${i})`} />)}
    </Svg>
  );
}
