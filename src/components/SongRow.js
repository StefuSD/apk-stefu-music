import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { tagColor } from '../context/ThemeContext';
import { usePlayerStatus } from '../context/PlayerContext';
import { COVERS_DIR } from '../context/LibraryContext';
import { fmtTime } from '../utils/format';
import { langName } from '../utils/languages';
import Equalizer from './Equalizer';
import { HeartIcon, MoreIcon, PlayIcon, HeadphonesIcon, VideoIcon, ScissorsIcon, CheckIcon, LyricsIcon } from './icons';

/*
 * Строка списка песен. Вынесена отдельно и обёрнута в memo, чтобы при быстрой
 * прокрутке не тратить время на лишние перерисовки:
 *  - строка НЕ слушает контекст библиотеки (он меняется при фоновом разборе
 *    сниппетов) — всё нужное приходит пропсами;
 *  - статус плеера (каждые 250 мс) слушает только играющая строка;
 *  - обложка через expo-image: картинка ужимается до размера кружка и
 *    кэшируется, а не декодируется в полном размере при каждом показе.
 */

/** Живая часть обложки играющей песни: эквалайзер или треугольник на паузе. */
function LiveMark({ size }) {
  const { playing } = usePlayerStatus();
  return playing
    ? <Equalizer playing color="#ffffff" size={size * 0.4} bars={4} />
    : <PlayIcon color="#ffffff" size={size * 0.56} style={{ marginLeft: size * 0.04 }} />;
}

/** Круглая обложка с кнопкой Play поверх; без картинки — тёмный круг. */
function RowCover({ song, current, ink, size = 54 }) {
  const uri = song.cover ? COVERS_DIR + song.cover : null;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: ink, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? (
        <Image source={{ uri }} recyclingKey={song.id} cachePolicy="memory-disk" transition={0}
          style={{ position: 'absolute', width: size, height: size }} />
      ) : null}
      {uri ? <View style={{ position: 'absolute', width: size, height: size, backgroundColor: 'rgba(0,0,0,0.32)' }} /> : null}
      {current ? <LiveMark size={size} /> : <PlayIcon color="#ffffff" size={size * 0.56} style={{ marginLeft: size * 0.04 }} />}
    </View>
  );
}

function LiveTime({ len, color }) {
  const { currentTime } = usePlayerStatus();
  return <Text style={{ color, fontSize: 12 }}>{fmtTime(currentTime)} / {len ? fmtTime(len) : '–:––'}</Text>;
}

/** «0:42 / 3:58»: у играющей песни идёт время; у обрезанной — длина куска и ножницы. */
function RowTime({ song, current, color }) {
  const trimmed = !!(song.trimStart || song.trimEnd);
  const len = song.duration ? Math.max(0, (song.trimEnd || song.duration) - (song.trimStart || 0)) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {current ? <LiveTime len={song.duration} color={color} />
        : <Text style={{ color, fontSize: 12 }}>{len ? fmtTime(len) : '–:––'}</Text>}
      {trimmed ? <ScissorsIcon color={color} size={12} style={{ marginLeft: 4 }} /> : null}
    </View>
  );
}

/**
 * onPress / onLongPress / onMore — постоянные функции (не меняются между
 * перерисовками экрана), получают песню.
 */
function SongRow({ song: s, plays, active, picked, selMode, colors, lang, t, onPress, onLongPress, onMore }) {
  return (
    <Pressable onPress={() => onPress(s)} onLongPress={() => onLongPress(s)}
      style={({ pressed }) => [st.card, {
        backgroundColor: picked ? colors.accentSoft : pressed ? colors.accentSoft : colors.bgCard,
        borderColor: picked ? colors.ink : active ? colors.accent + '66' : colors.border,
      }]}>
      {selMode ? (
        <View style={[st.check, picked ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.textMuted }]}>
          {picked ? <CheckIcon color={colors.onInk} size={18} /> : null}
        </View>
      ) : null}
      <RowCover song={s} current={active} ink={colors.ink} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={{ color: active ? colors.accent : colors.text, fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>{s.title}</Text>
          {s.fav && <HeartIcon color={colors.textMuted} size={14} style={{ marginLeft: 6, marginTop: 3 }} />}
          {!selMode && (
            <Pressable onPress={() => onMore(s)} hitSlop={12} style={{ marginLeft: 4, marginRight: -6, marginTop: -2, paddingHorizontal: 4 }}>
              <MoreIcon color={colors.textMuted} size={20} />
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14, flexShrink: 1 }} numberOfLines={1}>{s.artist || t('unknown_artist')}</Text>
          {s.langs?.length > 0 && (
            <Text style={{ color: colors.textMuted, fontSize: 11, fontWeight: '700', marginLeft: 8, letterSpacing: 0.5 }}>
              {s.langs.map(l => (l === 'none' ? langName(l, lang) : l.length <= 4 ? l.toUpperCase() : l)).join(' · ')}
            </Text>
          )}
          {/* значки: есть слова, есть клип */}
          {s.lyrics ? <LyricsIcon color={colors.textMuted} size={14} style={{ marginLeft: 6 }} /> : null}
          {s.videoUrl ? <VideoIcon color={colors.textMuted} size={14} style={{ marginLeft: 6 }} /> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
          <RowTime song={s} current={active} color={colors.textMuted} />
          {s.tags?.length > 0 && (
            <Text style={{ fontSize: 12, marginLeft: 10, flex: 1 }} numberOfLines={1}>
              <Text style={{ color: tagColor(colors), fontWeight: '500' }}>{s.tags.join(' · ')}</Text>
            </Text>
          )}
          {!(s.tags?.length > 0) && <View style={{ flex: 1 }} />}
          <HeadphonesIcon color={colors.textMuted} size={13} />
          <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 3 }}>{plays}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default memo(SongRow);

const st = StyleSheet.create({
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginVertical: 3, paddingLeft: 10, paddingRight: 12, paddingVertical: 10, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
});
