import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Circle, Ellipse, Path, G } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

/**
 * Фон шапки: у темы с colors.headerGlow — радиальные свечения поверх основы bgHeader
 * и мелкий декор colors.decor (снег, звёзды, конфетти, сердечки, лепестки, листья, пузырьки).
 * У светлой и тёмной темы ничего не рисует — шапка остаётся сплошной.
 * Ставится первым ребёнком шапки: лежит под содержимым и не влияет на раскладку.
 * theme — показать чужую тему (превью в настройках), а не текущую.
 */
export default function HeaderBg({ theme, small = !!theme }) {
  const cur = useTheme().colors;
  const colors = theme || cur;
  const [size, setSize] = useState(null);
  const glow = colors.headerGlow;
  if (!glow) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={e => setSize(e.nativeEvent.layout)}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
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
      {size && colors.decor && colors.decor !== 'none' ? <Decor kind={colors.decor} w={size.width} h={size.height} small={small} /> : null}
    </View>
  );
}

// Детерминированные «случайные» числа: декор одинаковый при каждом показе.
function rnd(seed) {
  let x = seed * 9301 + 49297;
  return () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
}

const CONFETTI = ['#ffd23f', '#ff5d8f', '#4cc9f0', '#3bceac', '#f72585', '#ffffff'];
const HEART = 'M0 3 C-3 0 -6 -1 -6 -3.5 C-6 -5.5 -4.5 -6.5 -3 -6.5 C-1.8 -6.5 -0.6 -5.8 0 -4.8 C0.6 -5.8 1.8 -6.5 3 -6.5 C4.5 -6.5 6 -5.5 6 -3.5 C6 -1 3 0 0 3 Z';

/** Мелкий декор поверх свечений, в пикселях (не растягивается вместе с шапкой). */
function Decor({ kind, w, h, small }) {
  const r = rnd(kind.length * 7 + 3);
  const n = Math.round((w * h) / (small ? 900 : 2600));
  const k = small ? 0.6 : 1;
  const items = [];
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = (0.6 + r() * 0.8) * k, rot = Math.round(r() * 360), c = r();
    if (kind === 'snow') items.push(<Circle key={i} cx={x} cy={y} r={1.2 + s * 1.6} fill="#ffffff" opacity={0.35 + c * 0.5} />);
    else if (kind === 'stars') items.push(<Circle key={i} cx={x} cy={y} r={0.6 + s * 0.9} fill="#ffffff" opacity={0.3 + c * 0.6} />);
    else if (kind === 'bubbles') items.push(<Circle key={i} cx={x} cy={y} r={2 + s * 4} fill="none" stroke="#ffffff" strokeWidth={1} opacity={0.25 + c * 0.3} />);
    else if (kind === 'confetti') items.push(<Rect key={i} x={x} y={y} width={2.5 * s + 1} height={6 * s + 1} fill={CONFETTI[Math.floor(c * CONFETTI.length)]} opacity={0.75} transform={`rotate(${rot} ${x} ${y})`} />);
    else if (kind === 'hearts') items.push(<G key={i} transform={`translate(${x} ${y}) scale(${s * 0.9}) rotate(${rot % 40 - 20})`}><Path d={HEART} fill={c > 0.5 ? '#ff8fab' : '#ffffff'} opacity={0.4 + c * 0.35} /></G>);
    else if (kind === 'petals') items.push(<Ellipse key={i} cx={x} cy={y} rx={2.2 * s + 1} ry={4 * s + 1} fill={c > 0.5 ? '#ffd1dc' : '#ffffff'} opacity={0.45 + c * 0.35} transform={`rotate(${rot} ${x} ${y})`} />);
    else if (kind === 'leaves') items.push(<Ellipse key={i} cx={x} cy={y} rx={2.5 * s + 1} ry={5 * s + 1.5} fill={c > 0.66 ? '#f2a541' : c > 0.33 ? '#e8740c' : '#c0392b'} opacity={0.55} transform={`rotate(${rot} ${x} ${y})`} />);
  }
  return <Svg style={StyleSheet.absoluteFill} width={w} height={h}>{items}</Svg>;
}
