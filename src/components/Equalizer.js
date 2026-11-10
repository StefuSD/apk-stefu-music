import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

/**
 * Прыгающие полоски «играет сейчас». Пока музыка играет, каждая полоска
 * ходит вверх-вниз в своём темпе; на паузе все опускаются и замирают.
 * Анимация на нативном потоке (scaleY), JS-поток не нагружает.
 */
const SPEEDS = [430, 330, 520, 380];
const PEAKS = [1, 0.75, 0.9, 0.6];

export default function Equalizer({ playing, color, size = 16, bars = 3 }) {
  const vals = useRef(SPEEDS.map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    const anims = [];
    vals.slice(0, bars).forEach((v, i) => {
      if (playing) {
        const a = Animated.loop(Animated.sequence([
          Animated.timing(v, { toValue: PEAKS[i], duration: SPEEDS[i], easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.2, duration: SPEEDS[i] * 0.9, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
        a.start();
        anims.push(a);
      } else {
        Animated.timing(v, { toValue: 0.25, duration: 250, useNativeDriver: true }).start();
      }
    });
    return () => anims.forEach(a => a.stop());
  }, [playing, bars]);

  const w = Math.max(2, Math.round(size / (bars * 1.7)));
  return (
    <View style={{ width: size, height: size, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
      {vals.slice(0, bars).map((v, i) => (
        <Animated.View key={i} style={{
          width: w, height: size, borderRadius: w / 2, backgroundColor: color,
          // scaleY от центра — сдвигаем, чтобы полоска росла от низа
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [size / 2, 0] }) }, { scaleY: v }],
        }} />
      ))}
    </View>
  );
}

/**
 * Широкая полоса эквалайзера над обложкой в полном плеере: много тонких
 * столбиков, у каждого свой темп и высота, — похоже на живой спектр.
 * На паузе столбики опускаются до низкой ровной линии.
 */
export function WideEqualizer({ playing, color, width, height = 40, bars = 28 }) {
  const vals = useRef(Array.from({ length: bars }, () => new Animated.Value(0.15))).current;
  // Псевдослучайные, но постоянные темп и пик у каждого столбика.
  const params = useRef(Array.from({ length: bars }, (_, i) => {
    const r = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    const mid = 1 - Math.abs(i - (bars - 1) / 2) / bars;      // в середине выше
    return { speed: 260 + Math.round(r * 380), peak: 0.35 + 0.65 * mid * (0.6 + r * 0.4) };
  })).current;
  useEffect(() => {
    const anims = [];
    vals.forEach((v, i) => {
      const { speed, peak } = params[i];
      if (playing) {
        const a = Animated.loop(Animated.sequence([
          Animated.timing(v, { toValue: peak, duration: speed, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.12 + peak * 0.2, duration: speed * 1.1, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]));
        a.start();
        anims.push(a);
      } else {
        Animated.timing(v, { toValue: 0.08, duration: 350, useNativeDriver: true }).start();
      }
    });
    return () => anims.forEach(a => a.stop());
  }, [playing]);
  const gap = 3;
  const w = Math.max(2, (width - gap * (bars - 1)) / bars);
  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end' }}>
      {vals.map((v, i) => (
        <Animated.View key={i} style={{
          width: w, height, marginLeft: i ? gap : 0, borderRadius: w / 2, backgroundColor: color,
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) }, { scaleY: v }],
        }} />
      ))}
    </View>
  );
}
