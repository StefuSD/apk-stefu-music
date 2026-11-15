import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { HeartIcon } from './icons';

/** Свой тост «В избранном» с красным сердечком. Системный ToastAndroid сам
    ставит значок приложения, поменять его нельзя — поэтому рисуем свой.
    showFavToast(text) показывает его во всех смонтированных <FavToast />
    (один — в корне приложения, второй — внутри окна плеера: Modal перекрывает корень). */
const listeners = new Set();
export function showFavToast(text) { listeners.forEach(fn => fn(text)); }

export default function FavToast({ bottom = 120 }) {
  const [text, setText] = useState(null);
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);
  useEffect(() => {
    const fn = (msg) => {
      setText(msg);
      clearTimeout(timer.current);
      Animated.timing(op, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(op, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => setText(null));
      }, 2000);
    };
    listeners.add(fn);
    return () => { listeners.delete(fn); clearTimeout(timer.current); };
  }, [op]);
  if (!text) return null;
  return (
    <Animated.View pointerEvents="none" style={[st.wrap, { bottom, opacity: op }]}>
      <Animated.View style={st.box}>
        <HeartIcon color="#e53935" size={20} />
        <Text style={st.text} numberOfLines={2}>{text}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 1000, elevation: 20 },
  box: {
    flexDirection: 'row', alignItems: 'center', maxWidth: '86%',
    backgroundColor: '#2b2b2f', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10,
  },
  text: { color: '#ffffff', fontSize: 15, marginLeft: 10, flexShrink: 1 },
});
