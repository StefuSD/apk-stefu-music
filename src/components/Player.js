import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ScrollView, Animated, Easing, Linking, Alert, Image } from 'react-native';
import { langName } from '../utils/languages';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import Equalizer, { WideEqualizer } from './Equalizer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { fmtTime } from '../utils/format';
import Cover from './Cover';
import AbstractArt from './AbstractArt';
import { similarSongs } from '../utils/recommend';
import { shareSong } from '../utils/shareSong';
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon,
  DownIcon, CloseIcon, HeartIcon, HeartOffIcon, EditIcon, RadioIcon, LyricsIcon, VideoIcon, LanguageIcon,
} from './icons';

/** Полоса прогресса: тап или протяжка — перемотка. */
function SeekBar({ color, track }) {
  const { currentTime, duration } = usePlayerStatus();
  const { seek } = usePlayer();
  const [drag, setDrag] = useState(null);
  const width = useRef(1);
  const pos = drag != null ? drag : (duration ? currentTime / duration : 0);
  const at = (x) => Math.max(0, Math.min(1, x / width.current));
  return (
    <View>
      <View
        style={{ height: 32, justifyContent: 'center' }}
        onLayout={e => { width.current = e.nativeEvent.layout.width || 1; }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={e => setDrag(at(e.nativeEvent.locationX))}
        onResponderMove={e => setDrag(at(e.nativeEvent.locationX))}
        onResponderRelease={() => { if (drag != null && duration) seek(drag * duration); setDrag(null); }}
      >
        <View pointerEvents="none" style={{ height: 5, borderRadius: 3, backgroundColor: track }}>
          <View style={{ width: `${pos * 100}%`, height: 5, borderRadius: 3, backgroundColor: color }} />
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: `${pos * 100}%`, marginLeft: -8, width: 16, height: 16, borderRadius: 8, backgroundColor: color }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: track === '#ffffff33' ? '#ffffffb0' : color, fontSize: 12 }}>{fmtTime(drag != null ? drag * duration : currentTime)}</Text>
        <Text style={{ color: track === '#ffffff33' ? '#ffffffb0' : color, fontSize: 12 }}>{fmtTime(duration)}</Text>
      </View>
    </View>
  );
}

/** id ролика YouTube из ссылки (watch?v=, youtu.be/, shorts/, embed/, live/, music.youtube.com) или null. */
function youtubeId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/i);
  return m ? m[1] : null;
}

/** Превью видео песни: картинка YouTube, по нажатию открывается ролик. Без сети или для другой ссылки — ничего. */
function VideoPreview({ url, width, label, onOpen }) {
  const id = youtubeId(url);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [id]);
  if (!id || failed) return null;
  const h = Math.round(width * 9 / 16);
  return (
    <Pressable onPress={onOpen} style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <VideoIcon color="#ffffffb0" size={16} />
        <Text style={{ color: '#ffffffb0', fontWeight: '700', marginLeft: 6 }}>{label}</Text>
      </View>
      <View style={{ width, height: h, borderRadius: 14, overflow: 'hidden', backgroundColor: '#ffffff14' }}>
        <Image source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }} onError={() => setFailed(true)}
          style={{ width, height: h }} resizeMode="cover" />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#000000a0', alignItems: 'center', justifyContent: 'center' }}>
            <PlayIcon color="#ffffff" size={36} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Полноэкранный плеер. */
export function PlayerSheet({ visible, onClose, onEdit }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const p = usePlayer();
  const { playing } = usePlayerStatus();
  const song = lib.byId[p.currentId];
  const size = Math.min(Dimensions.get('window').width - 64, 340);
  const W = '#ffffff';
  const upNext = p.queue.slice(p.index + 1, p.index + 30).map(id => lib.byId[id]).filter(Boolean);
  const similar = useMemo(() => (visible && song ? similarSongs(song, lib.songs, lib.recIndex, 10) : []),
    [visible, song, lib.songs, lib.recIndex]);
  const playNow = (id) => { p.playNext(id); p.next(); };
  // Слова вместо обложки: выбор запоминается, пока плеер открыт.
  const [lyricsOn, setLyricsOn] = useState(false);
  const coverSrc = song ? lib.coverUri(song) : null;
  const bgH = Math.round(Dimensions.get('window').height * 0.68);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.player, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 10 }}>
        {/* Обложка — фон под названием и кнопками. Сверху и снизу затемнение,
            чтобы белый текст и кнопки читались на любой картинке; книзу
            обложка растворяется в цвете плеера. */}
        {song ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, height: bgH }}>
            {/* Без обложки — абстракция, своя у каждой песни (AbstractArt). */}
            {coverSrc
              ? <Image source={{ uri: coverSrc }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              : <AbstractArt seed={song.id} theme={song.artTheme} variant={song.artVariant} />}
            <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
              <Defs>
                <LinearGradient id="coverShade" x1="0" y1="0" x2="0" y2="1">
                  {/* у фото затемнение сильнее; абстракция и так спокойная */}
                  <Stop offset="0" stopColor="#000000" stopOpacity={coverSrc ? 0.55 : 0.3} />
                  <Stop offset="0.35" stopColor="#000000" stopOpacity={coverSrc ? 0.25 : 0.05} />
                  <Stop offset="0.7" stopColor={colors.player} stopOpacity="0.75" />
                  <Stop offset="1" stopColor={colors.player} stopOpacity="1" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverShade)" />
            </Svg>
          </View>
        ) : null}
        <View style={st.topRow}>
          <Pressable onPress={onClose} hitSlop={12} style={st.round}><DownIcon color={W} size={28} /></Pressable>
          <Text style={{ color: '#ffffff99', fontWeight: '600', letterSpacing: 1.5, fontSize: 11 }}>{t('now_playing').toUpperCase()}</Text>
          <Pressable onPress={() => song && onEdit(song)} hitSlop={12} style={st.round}><EditIcon color={W} size={22} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 20 }}>
          <View style={{ alignItems: 'center', marginTop: 18, marginBottom: 14, opacity: 0.55 }}>
            <WideEqualizer playing={playing} color={colors.playerSoft} width={size} height={30} bars={36} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: song ? Math.round(bgH * 0.36) : 4 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: W, fontSize: 22, fontWeight: '700' }} numberOfLines={2}>{song ? song.title : '—'}</Text>
              <Text style={{ color: '#ffffffb0', fontSize: 16, marginTop: 4 }} numberOfLines={1}>{song ? (song.artist || t('unknown_artist')) : ''}</Text>
            </View>
            {song && (
              <Pressable hitSlop={10} onPress={() => lib.updateSong(song.id, { fav: !song.fav })} style={{ padding: 6 }}>
                {song.fav ? <HeartIcon color="#ffffff" size={26} /> : <HeartOffIcon color="#ffffff80" size={26} />}
              </Pressable>
            )}
          </View>
          {song && (song.tags?.length > 0 || song.langs?.length > 0) && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {(song.langs || []).map(l => (
                <View key={'l' + l} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#ffffff40' }}>
                  <LanguageIcon color="#ffffffb0" size={13} />
                  <Text style={{ color: W, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>{langName(l, lang)}</Text>
                </View>
              ))}
              {(song.tags || []).map(tg => (
                <View key={tg} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, backgroundColor: '#ffffff22' }}>
                  <Text style={{ color: W, fontSize: 12, fontWeight: '600' }}>{tg}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={{ marginTop: 22 }}>
            <SeekBar color={W} track="#ffffff33" />
          </View>
          <View style={st.controls}>
            <Pressable onPress={p.toggleShuffle} hitSlop={10} style={st.side}>
              <ShuffleIcon color={p.shuffle ? colors.playerSoft : '#ffffff70'} size={26} />
            </Pressable>
            <Pressable onPress={p.prev} hitSlop={10}><PrevIcon color={W} size={40} /></Pressable>
            <Pressable onPress={p.toggle} style={st.bigBtn}>
              {playing ? <PauseIcon color={colors.player} size={40} /> : <PlayIcon color={colors.player} size={42} />}
            </Pressable>
            <Pressable onPress={p.next} hitSlop={10}><NextIcon color={W} size={40} /></Pressable>
            <Pressable onPress={p.cycleRepeat} hitSlop={10} style={st.side}>
              {p.repeat === 'one' ? <RepeatOneIcon color={colors.playerSoft} size={26} />
                : <RepeatIcon color={p.repeat === 'all' ? colors.playerSoft : '#ffffff70'} size={26} />}
            </Pressable>
          </View>
          <Text style={{ color: '#ffffff80', textAlign: 'center', fontSize: 12 }}>
            {t(p.repeat === 'one' ? 'repeat_one' : p.repeat === 'all' ? 'repeat_all' : 'repeat_off')}
            {p.shuffle ? ' · ' + t('shuffle') : ''}
          </Text>
          {song && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 14 }}>
              <Pressable onPress={() => setLyricsOn(v => !v)}
                style={[st.pill, lyricsOn ? { backgroundColor: W, borderColor: W } : null]}>
                <Text style={{ color: lyricsOn ? colors.player : W, fontWeight: '600' }}>{t('lyrics')}</Text>
              </Pressable>
              <Pressable onPress={() => shareSong(song, { songUri: lib.songUri(song), coverUri: lib.coverUri(song) }).catch(e => Alert.alert('', String(e?.message || e)))} style={st.pill}>
                <Text style={{ color: W, fontWeight: '600' }}>{t('share')}</Text>
              </Pressable>
              {song.videoUrl ? (
                <Pressable onPress={() => Linking.openURL(song.videoUrl).catch(() => Alert.alert('', t('video_bad', { u: song.videoUrl })))} style={st.pill}>
                  <Text style={{ color: W, fontWeight: '600' }}>{t('video')}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
          {/* Слова — под кнопками, по кнопке «Слова». Обложка — фон плеера (выше). */}
          {song && lyricsOn ? (
          <View style={{ alignItems: 'center', marginTop: 22 }}>
            {(
              <View style={{ width: '100%', maxHeight: 420, borderRadius: 18, backgroundColor: '#ffffff14', overflow: 'hidden' }}>
                {song.lyrics ? (
                  <ScrollView nestedScrollEnabled contentContainerStyle={{ padding: 20 }}>
                    <Text style={{ color: W, fontSize: 18, lineHeight: 29, fontWeight: '600' }}>{song.lyrics}</Text>
                  </ScrollView>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                    <LyricsIcon color="#ffffff80" size={40} />
                    <Text style={{ color: '#ffffffb0', textAlign: 'center', marginTop: 12, lineHeight: 20 }}>{t('lyrics_none')}</Text>
                    <Pressable onPress={() => onEdit(song)} style={{ marginTop: 16, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, backgroundColor: W }}>
                      <Text style={{ color: colors.player, fontWeight: '700' }}>{t('lyrics_add')}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
          ) : null}
          {song && (
            <View style={{ marginTop: 22 }}>
              <Text style={{ color: '#ffffffb0', fontWeight: '700', marginBottom: 8 }}>{t('similar')}</Text>
              {similar.length === 0 ? (
                <Text style={{ color: '#ffffff80', fontSize: 13 }}>{t('similar_none')}</Text>
              ) : similar.map(({ song: s, why }) => (
                <Pressable key={s.id} onPress={() => playNow(s.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Cover song={s} size={38} radius={8} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: W, fontWeight: '600' }} numberOfLines={1}>{s.title}</Text>
                    <Text style={{ color: '#ffffff90', fontSize: 12 }} numberOfLines={1}>
                      {s.artist || t('unknown_artist')}{why.length ? '  ·  ' + why.slice(0, 3).join(' · ') : ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
          {song?.videoUrl ? (
            <VideoPreview url={song.videoUrl} width={Dimensions.get('window').width - 56} label={t('video')}
              onOpen={() => Linking.openURL(song.videoUrl).catch(() => Alert.alert('', t('video_bad', { u: song.videoUrl })))} />
          ) : null}
          {upNext.length > 0 && (
            <View style={{ marginTop: 26 }}>
              <Text style={{ color: '#ffffffb0', fontWeight: '700', marginBottom: 8 }}>{t('queued')}</Text>
              {upNext.map((s, k) => (
                <Pressable key={s.id + k} onPress={() => p.playList(p.queue, s.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                  <Cover song={s} size={38} radius={8} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: W, fontWeight: '600' }} numberOfLines={1}>{s.title}</Text>
                    <Text style={{ color: '#ffffff90', fontSize: 12 }} numberOfLines={1}>{s.artist || t('unknown_artist')}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** Мини-плеер над нижним меню. */
export function MiniPlayer({ onOpen }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  const p = usePlayer();
  const { playing, currentTime, duration } = usePlayerStatus();
  const song = lib.byId[p.currentId];
  if (!song) return null;
  const pos = duration ? currentTime / duration : 0;
  return (
    // Сплошной цвет: голубой в светлой теме, тёмно-синий в тёмной (без градиента)
    <Pressable onPress={onOpen} style={{ backgroundColor: colors.miniBottom, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.miniEdge }}>
      <View style={{ height: 3, backgroundColor: colors.miniTrack }}>
        <View style={{ height: 3, width: `${pos * 100}%`, backgroundColor: colors.miniBar }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
        <Cover song={song} size={42} radius={8} />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Equalizer playing={playing} color={colors.miniBar} size={13} />
            <Text style={{ color: colors.miniText, fontWeight: '700', fontSize: 15, marginLeft: 7, flex: 1 }} numberOfLines={1}>{song.title}</Text>
          </View>
          <Text style={{ color: colors.miniSub, fontSize: 12 }} numberOfLines={1}>{song.artist || t('unknown_artist')}</Text>
        </View>
        <Pressable onPress={p.toggle} hitSlop={10} style={{ padding: 6 }}>
          {playing ? <PauseIcon color={colors.miniText} size={32} /> : <PlayIcon color={colors.miniText} size={32} />}
        </Pressable>
        <Pressable onPress={p.next} hitSlop={10} style={{ padding: 6 }}>
          <NextIcon color={colors.miniText} size={30} />
        </Pressable>
        <Pressable onPress={p.stop} hitSlop={10} style={{ padding: 6, marginLeft: 2 }}>
          <CloseIcon color={colors.miniSub} size={24} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff18' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  side: { padding: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#ffffff55' },
  bigBtn: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
