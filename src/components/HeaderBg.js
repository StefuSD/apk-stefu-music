import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect, Path, G } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { SHAPES, DECOR, layoutDecor } from './decor';

/**
 * Фон шапки: у темы с colors.headerGlow — радиальные свечения поверх основы bgHeader
 * и монохромный декор colors.decor — свой набор силуэтов у каждой темы (снежинки, летучие мыши, клён…),
 * цветом текста шапки; силуэты и раскладка — src/components/decor.js.
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
      {size && DECOR[colors.decor] ? <Decor kind={colors.decor} w={Math.round(size.width)} h={Math.round(size.height)} small={small} color={colors.headerText || '#ffffff'} /> : null}
    </View>
  );
}

const part = (p, s, color, i) => p.fill
  ? <Path key={i} d={p.d} fill={color} fillRule={p.evenodd ? 'evenodd' : 'nonzero'} />
  : <Path key={i} d={p.d} fill="none" stroke={color} strokeWidth={Math.max(p.sw || 1.4, 1 / s)} strokeLinecap="round" strokeLinejoin="round" />;

/** Монохромный декор поверх свечений, в пикселях (не растягивается вместе с шапкой). Раскладка — decor.js. */
const Decor = React.memo(function Decor({ kind, w, h, small, color }) {
  const items = useMemo(() => layoutDecor(kind, w, h, small), [kind, w, h, small]);
  return (
    <Svg style={StyleSheet.absoluteFill} width={w} height={h}>
      {items.map((it, i) => (
        <G key={i} transform={`translate(${it.x} ${it.y}) rotate(${it.r}) scale(${it.s})`} opacity={it.o}>
          {SHAPES[it.shape].map((p, j) => part(p, it.s, color, j))}
        </G>
      ))}
    </Svg>
  );
});
