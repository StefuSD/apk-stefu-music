import React from 'react';
import { View, Image, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLibrary } from '../context/LibraryContext';
import { PlayIcon, MusicIcon } from './icons';

/** Обложка песни; без картинки — тёмный квадрат с треугольником Play (цвет по исполнителю). */
export default function Cover({ song, size = 48, radius = 10 }) {
  const { colors } = useTheme();
  const { coverUri } = useLibrary();
  const uri = coverUri(song);
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.bgInput }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      {/* Большая заглушка (полный плеер) — спокойная нота: треугольник там выглядел бы кнопкой. */}
      {size >= 120
        ? <MusicIcon size={size * 0.28} color={colors.onInk + '55'} />
        : <PlayIcon size={size * 0.46} color={colors.onInk} />}
    </View>
  );
}
