import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { THEMES, THEME_BY_ID } from '../data/themes';

/**
 * Абстрактный фон песни без обложки: градиент основы, мягкие цветные пятна
 * и декор темы (снег, звёзды, конфетти).
 *
 * theme   — id темы из src/data/themes.js, выбранной в карточке песни;
 *           null — тема подбирается сама по seed (без праздничных).
 * seed    — id песни: у каждой песни свой рисунок, постоянный между запусками.
 * variant — «другой узор»: те же цвета, пятна лежат иначе.
 * small   — превью в списке тем: меньше декора, чтобы окно не тормозило.
 */
const AUTO = THEMES.filter(t => t.cat !== 'holidays');

function rng(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Тема, которую покажет песня (выбранная или подобранная автоматически). */
export function resolveTheme(seed, theme) {
  if (theme && THEME_BY_ID[theme]) return THEME_BY_ID[theme];
  const r = rng(seed || 'stefu');
  return AUTO[Math.floor(r() * AUTO.length)];
}

const DECOR_N = { snow: 46, stars: 60, confetti: 34, none: 0 };

export default function AbstractArt({ seed, theme, variant, small, style }) {
  const th = resolveTheme(seed, theme);
  const art = useMemo(() => {
    const r = rng((seed || 'stefu') + ':' + th.id + ':' + (variant || 0));
    const blobs = Array.from({ length: 5 }, (_, i) => ({
      cx: 0.05 + r() * 0.9, cy: 0.05 + r() * 0.8,
      rad: 0.4 + r() * 0.45,
      color: th.blobs[i % th.blobs.length],
      op: 0.7 + r() * 0.3,
    }));
    const n = Math.round((DECOR_N[th.decor] || 0) * (small ? 0.35 : 1));
    const pal = [...th.blobs, '#ffffff'];
    const dots = Array.from({ length: n }, () => {
      const x = r() * 100, y = r() * 100;
      if (th.decor === 'snow') return { x, y, rad: 0.35 + r() * 0.9, color: '#ffffff', op: 0.45 + r() * 0.5 };
      if (th.decor === 'stars') return { x, y, rad: 0.15 + r() * 0.45, color: '#ffffff', op: 0.3 + r() * 0.7 };
      return { x, y, rad: 0.5 + r() * 0.9, color: pal[Math.floor(r() * pal.length)], op: 0.6 + r() * 0.4 };
    });
    return { blobs, dots, angle: r() };
  }, [seed, th.id, variant, small]);
  const id = 'aa' + (seed || '').replace(/[^a-z0-9]/gi, '').slice(0, 10) + th.id.replace(/[^a-z0-9]/gi, '') + (variant || 0) + (small ? 's' : '');
  return (
    <Svg style={[StyleSheet.absoluteFill, style]} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={id + 'b'} x1={art.angle} y1="0" x2={1 - art.angle} y2="1">
          <Stop offset="0" stopColor={th.base[0]} stopOpacity="1" />
          <Stop offset="1" stopColor={th.base[1]} stopOpacity="1" />
        </LinearGradient>
        {art.blobs.map((b, i) => (
          <RadialGradient key={i} id={id + i} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={b.color} stopOpacity={b.op} />
            <Stop offset="0.55" stopColor={b.color} stopOpacity={b.op * 0.45} />
            <Stop offset="1" stopColor={b.color} stopOpacity="0" />
          </RadialGradient>
        ))}
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id}b)`} />
      {art.blobs.map((b, i) => (
        <Circle key={i} cx={b.cx * 100} cy={b.cy * 100} r={b.rad * 100} fill={`url(#${id + i})`} />
      ))}
      {art.dots.map((d, i) => (
        <Circle key={'d' + i} cx={d.x} cy={d.y} r={d.rad} fill={d.color} fillOpacity={d.op} />
      ))}
    </Svg>
  );
}
