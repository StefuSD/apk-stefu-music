import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Dimensions, ScrollView, Animated, Easing, Linking, Alert, Image, BackHandler } from 'react-native';
import { langName } from '../utils/languages';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { fmtTime } from '../utils/format';
import Cover from './Cover';
import AbstractArt from './AbstractArt';
import ActionSheet from './ActionSheet';
import { similarSongs } from '../utils/recommend';
import { shareSong, embedTags } from '../utils/shareSong';
import * as Clipboard from 'expo-clipboard';
import { TextInput } from 'react-native';
import { snippetRange } from '../utils/snippet';
import { usePro } from '../pro/ProContext';
import { ToastAndroid } from 'react-native';
import FavToast, { showFavToast } from './FavToast';
import { openCoverSearch } from '../utils/coverWeb';
import { navRef } from '../navigation/navRef';
import { artistsOf } from '../utils/artists';
import {
  PlayIcon, PauseIcon, NextIcon, PrevIcon, ShuffleIcon, RepeatIcon, RepeatOneIcon,
  DownIcon, CloseIcon, HeartIcon, HeartOffIcon, EditIcon, RadioIcon, LyricsIcon, BoltIcon, VideoIcon, LanguageIcon, MoonIcon, ImageIcon,
} from './icons';

/** Подпись кнопки таймера сна: «Сон · 23 мин» или «После песни»; обновляется раз в 15 с. */
function useSleepLabel(sleep, t) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!sleep || !sleep.at) return;
    const iv = setInterval(() => setTick(x => x + 1), 15000);
    return () => clearInterval(iv);
  }, [sleep]);
  if (!sleep) return t('sleep');
  if (sleep.end) return t('sleep_end_short');
  return t('sleep_left', { n: Math.max(1, Math.ceil((sleep.at - Date.now()) / 60000)) });
}

/** Полоса прогресса: тап или протяжка — перемотка. song — для отрезка сниппета: светлая полоса под дорожкой. */
function SeekBar({ color, track, song }) {
  const { currentTime, duration } = usePlayerStatus();
  // Отрезок сниппета виден всегда: найденный припев, а если его ещё нет — тот же отрезок, что играет режим сниппетов.
  const band = song && duration > 0 ? snippetRange(song, duration) : null;
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
        {band && duration > 0 ? (
          <View pointerEvents="none" style={{
            position: 'absolute', left: `${(band[0] / duration) * 100}%`, width: `${(Math.max(0, band[1] - band[0]) / duration) * 100}%`,
            height: 13, borderRadius: 4, backgroundColor: '#ffffff40', borderWidth: 1, borderColor: '#ffffff80', top: 9.5,
          }} />
        ) : null}
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

/**
 * Слова песни прямо в плеере. Нет слов — сразу поле: «Вставить» из буфера,
 * правка, «Сохранить» — без перехода в карточку песни. Есть — текст и
 * «Изменить». Сохраняются в библиотеку и в сам файл (как «Сохранить» в карточке).
 */
function LyricsPanel({ song, onFocusInput }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  const W = '#ffffff';
  const [editing, setEditing] = useState(!song.lyrics);
  const [text, setText] = useState(song.lyrics || '');
  useEffect(() => { setEditing(!song.lyrics); setText(song.lyrics || ''); }, [song.id]);

  const paste = async () => {
    try {
      const s = (await Clipboard.getStringAsync() || '').replace(/\r\n?/g, '\n').trim();
      if (!s) { ToastAndroid.show(t('clipboard_empty'), ToastAndroid.SHORT); return; }
      setText(cur => (cur.trim() ? cur.trimEnd() + '\n\n' + s : s));
    } catch (e) { /* буфер недоступен */ }
  };
  // Поиск слов в Google: исполнитель + название + «текст песни» на языке интерфейса.
  // Приложение только открывает браузер — скопировать слова и нажать «Вставить».
  const findOnline = () => {
    const q = [song.artist, song.title, t('lyrics_query')].filter(Boolean).join(' ');
    Linking.openURL('https://www.google.com/search?q=' + encodeURIComponent(q)).catch(() => {});
  };
  const save = () => {
    const lyrics = text.trim();
    lib.updateSong(song.id, { lyrics });
    const merged = { ...song, lyrics };
    embedTags(merged, { songUri: lib.songUri(merged), coverUri: lib.coverUri(merged) }).catch(() => {});
    setEditing(!lyrics);
    ToastAndroid.show(t('lyrics_saved'), ToastAndroid.SHORT);
  };
  const btn = { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: '#ffffff55' };

  if (!editing) {
    return (
      <View style={{ width: '100%', borderRadius: 18, backgroundColor: '#ffffff14', overflow: 'hidden' }}>
        <ScrollView nestedScrollEnabled style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 20 }}>
          <Text style={{ color: W, fontSize: 18, lineHeight: 29, fontWeight: '600' }}>{song.lyrics}</Text>
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, margin: 12 }}>
          <Pressable onPress={findOnline} style={btn}>
            <Text style={{ color: W, fontWeight: '700' }}>{t('lyrics_google')}</Text>
          </Pressable>
          <Pressable onPress={() => { setText(song.lyrics || ''); setEditing(true); }} style={btn}>
            <Text style={{ color: W, fontWeight: '700' }}>{t('lyrics_edit')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }
  return (
    <View style={{ width: '100%', borderRadius: 18, backgroundColor: '#ffffff14', padding: 14 }}>
      {!song.lyrics ? <Text style={{ color: '#ffffffb0', lineHeight: 20, marginBottom: 10 }}>{t('lyrics_none')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <Pressable onPress={paste} style={[btn, { backgroundColor: W, borderColor: W }]}>
          <Text style={{ color: colors.player, fontWeight: '700' }}>{t('lyrics_paste')}</Text>
        </Pressable>
        <Pressable onPress={findOnline} style={btn}>
          <Text style={{ color: W, fontWeight: '700' }}>{t('lyrics_google')}</Text>
        </Pressable>
        {text ? (
          <Pressable onPress={() => setText('')} style={btn}>
            <Text style={{ color: W, fontWeight: '700' }}>{t('lyrics_clear')}</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput value={text} onChangeText={setText} multiline placeholder={t('lyrics_hint')} placeholderTextColor="#ffffff70"
        onFocus={onFocusInput} textAlignVertical="top"
        style={{ color: W, fontSize: 16, lineHeight: 24, minHeight: 140, maxHeight: 320, padding: 12, borderRadius: 12, backgroundColor: '#00000040' }} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        {song.lyrics ? (
          <Pressable onPress={() => setEditing(false)} style={btn}>
            <Text style={{ color: W, fontWeight: '700' }}>{t('cancel')}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={save} disabled={text.trim() === (song.lyrics || '').trim()}
          style={[btn, { backgroundColor: W, borderColor: W, opacity: text.trim() === (song.lyrics || '').trim() ? 0.5 : 1 }]}>
          <Text style={{ color: colors.player, fontWeight: '700' }}>{t('lyrics_save')}</Text>
        </Pressable>
      </View>
    </View>
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
  const openArtist = (name) => {
    onClose();
    try { navRef.navigate('Music', { linkSearch: { q: name, filter: 'all' }, linkAt: Date.now() }); } catch (e) { /* */ }
  };
  const song = lib.byId[p.currentId];
  const size = Math.min(Dimensions.get('window').width - 64, 340);
  const W = '#ffffff';
  const upNext = p.queue.slice(p.index + 1, p.index + 30).map(id => lib.byId[id]).filter(Boolean);
  const similar = useMemo(() => (visible && song ? similarSongs(song, lib.songs, lib.recIndex, 10) : []),
    [visible, song, lib.songs, lib.recIndex]);
  const playNow = (id) => { p.playNext(id); p.next(); };
  // Слова вместо обложки: выбор запоминается, пока плеер открыт.
  const [lyricsOn, setLyricsOn] = useState(false);
  const scrollRef = useRef(null);
  const lyricsY = useRef(0);
  const coverSrc = song ? lib.coverUri(song) : null;
  const bgH = Math.round(Dimensions.get('window').height * 0.68);
  const [sleepMenu, setSleepMenu] = useState(false);
  const pro = usePro();
  const sleepLabel = useSleepLabel(p.sleep, t);

  return (
    // Не Modal, а слой поверх приложения в том же окне: окну Modal React Native сам рисует под системными
    // кнопками светлую подложку (в светлой теме телефона), а здесь системная панель прозрачная —
    // под кнопками видно плеер. Список внизу получает отступ на высоту панели (insets.bottom).
    <SlideSheet visible={visible} onClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.player, paddingTop: insets.top + 6 }}>
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
        <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 28, paddingBottom: 30 + insets.bottom }}>
          {/* Название сразу под верхними кнопками: обложка/абстракция остаётся фоном, без пустого места сверху. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 22 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: W, fontSize: 22, fontWeight: '700' }} numberOfLines={2}>{song ? song.title : '—'}</Text>
              {/* Исполнители — чипами: тап ведёт к его песням (плеер закрывается, в «Музыке» поиск по имени). */}
              {song && artistsOf(song).length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                  {artistsOf(song).map((a, i) => (
                    <Pressable key={a + i} onPress={() => openArtist(a)} style={st.artistChip}>
                      <Text style={{ color: W, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{a}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text style={{ color: '#ffffffb0', fontSize: 16, marginTop: 4 }} numberOfLines={1}>{song ? t('unknown_artist') : ''}</Text>
              )}
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
          {p.snippets && song ? (
            <View style={st.snipBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <BoltIcon color={W} size={16} />
                <Text style={{ color: W, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{t('snip_mode').toUpperCase()}</Text>
              </View>
              <Text style={{ color: '#ffffffb0', fontSize: 12, marginTop: 2 }}>{t('snip_mode_hint')}</Text>
              {pro.limit('snippetsDay') !== Infinity ? (
                <Text style={{ color: '#ffffffb0', fontSize: 12, marginTop: 2 }}>
                  {t('snip_left', { n: Math.max(0, pro.limit('snippetsDay') - p.snipUsed), m: pro.limit('snippetsDay') })}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                <Pressable onPress={() => { lib.updateSong(song.id, { fav: !song.fav }); if (!song.fav) showFavToast(t('snip_liked')); }}
                  accessibilityLabel={t('snip_like')}
                  style={[st.snipBtn, { flex: 0, width: 52 }, song.fav ? { backgroundColor: W, borderColor: W } : null]}>
                  {/* «Нравится» — одно сердечко */}
                  {song.fav ? <HeartIcon color={colors.player} size={22} /> : <HeartOffIcon color={W} size={22} />}
                </Pressable>
                <Pressable onPress={p.playFull} style={st.snipBtn}>
                  <PlayIcon color={W} size={18} />
                  <Text style={{ color: W, fontWeight: '700', marginLeft: 3, flexShrink: 1 }} numberOfLines={1}>{t('snip_full')}</Text>
                </Pressable>
                <Pressable onPress={p.next} style={st.snipBtn}>
                  <NextIcon color={W} size={18} />
                  <Text style={{ color: W, fontWeight: '700', marginLeft: 3, flexShrink: 1 }} numberOfLines={1}>{t('snip_next')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <View style={{ marginTop: 22 }}>
            <SeekBar color={W} track="#ffffff33" song={song} />
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
              {/* Слова есть — значок строчек и «Слова»; нет — «+ Слова» с пунктирной рамкой. */}
              <Pressable onPress={() => setLyricsOn(v => !v)}
                style={[st.pill, lyricsOn ? { backgroundColor: W, borderColor: W }
                  : !song.lyrics ? { borderStyle: 'dashed', borderColor: '#ffffff40' } : null]}>
                {song.lyrics
                  ? <LyricsIcon color={lyricsOn ? colors.player : W} size={16} style={{ marginRight: 6 }} />
                  : <Text style={{ color: lyricsOn ? colors.player : '#ffffffb0', fontWeight: '700', marginRight: 4 }}>+</Text>}
                <Text style={{ color: lyricsOn ? colors.player : song.lyrics ? W : '#ffffffb0', fontWeight: '600' }}>{t('lyrics')}</Text>
              </Pressable>
              <Pressable onPress={() => shareSong(song, { songUri: lib.songUri(song), coverUri: lib.coverUri(song) }).catch(e => Alert.alert('', String(e?.message || e)))} style={st.pill}>
                <Text style={{ color: W, fontWeight: '600' }}>{t('share')}</Text>
              </Pressable>
              <Pressable onPress={() => openCoverSearch(song.artist, song.title)} style={st.pill}>
                <ImageIcon color={W} size={16} style={{ marginRight: 6 }} />
                <Text style={{ color: W, fontWeight: '600' }}>{t('cover_web')}</Text>
              </Pressable>
              {song.videoUrl ? (
                <Pressable onPress={() => Linking.openURL(song.videoUrl).catch(() => Alert.alert('', t('video_bad', { u: song.videoUrl })))} style={st.pill}>
                  <Text style={{ color: W, fontWeight: '600' }}>{t('video')}</Text>
                </Pressable>
              ) : null}
              {!p.snippets ? (
                <Pressable onPress={p.seekChorus} style={st.pill}>
                  <Text style={{ color: W, fontWeight: '600' }}>{t('chorus_jump')}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => p.setSnippets(!p.snippets)} style={[st.pill, p.snippets ? { backgroundColor: W, borderColor: W } : null]}>
                <BoltIcon color={p.snippets ? colors.player : W} size={16} style={{ marginRight: 6 }} />
                <Text style={{ color: p.snippets ? colors.player : W, fontWeight: '600' }}>{t('snip_mode')}</Text>
              </Pressable>
              <Pressable onPress={() => setSleepMenu(true)} style={[st.pill, p.sleep ? { backgroundColor: W, borderColor: W } : null]}>
                <MoonIcon color={p.sleep ? colors.player : W} size={16} style={{ marginRight: 6 }} />
                <Text style={{ color: p.sleep ? colors.player : W, fontWeight: '600' }}>{sleepLabel}</Text>
              </Pressable>
            </View>
          )}
          {/* Слова — под кнопками, по кнопке «Слова». Обложка — фон плеера (выше). */}
          {song && lyricsOn ? (
          <View style={{ alignItems: 'center', marginTop: 22 }} onLayout={e => { lyricsY.current = e.nativeEvent.layout.y; }}>
            {/* Поле слов поднимаем к верху экрана, чтобы клавиатура его не закрыла. */}
            <LyricsPanel song={song} onFocusInput={() => setTimeout(() => scrollRef.current && scrollRef.current.scrollTo({ y: Math.max(0, lyricsY.current - 20), animated: true }), 250)} />
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
                      {s.artist || t('unknown_artist')}{(() => { const w = why.filter(x => !(s.artist || '').toLowerCase().includes(String(x).toLowerCase())); return w.length ? '  ·  ' + w.slice(0, 3).join(' · ') : ''; })()}
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
        {visible ? <FavToast bottom={90} /> : null}
      </View>
      <ActionSheet visible={sleepMenu} title={t('sleep')} subtitle={t('sleep_hint')} onClose={() => setSleepMenu(false)}
        items={[
          ...[15, 30, 45, 60, 90].map(n => ({ label: t('sleep_min', { n }), onPress: () => p.setSleep(n) })),
          { label: t('sleep_end'), onPress: () => p.setSleep('end') },
          ...(p.sleep ? [{ label: t('sleep_off'), danger: true, onPress: () => p.setSleep(null) }] : []),
        ]} />
    </SlideSheet>
  );
}

/** Полноэкранный слой, выезжающий снизу (замена Modal без своего окна); «Назад» закрывает. */
function SlideSheet({ visible, onClose, children }) {
  const h = Dimensions.get('window').height;
  const y = useRef(new Animated.Value(visible ? 0 : h)).current;
  const [mounted, setMounted] = useState(visible);
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(y, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(y, { toValue: h, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(() => setMounted(false));
    }
  }, [visible]);
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { onClose(); return true; });
    return () => sub.remove();
  }, [visible, onClose]);
  if (!mounted) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: y }] }]}>
      {children}
    </Animated.View>
  );
}

/** Мини-плеер над нижним меню. */
export function MiniPlayer({ onOpen }) {
  const { colors, isDark } = useTheme();
  const { t } = useLang();
  const lib = useLibrary();
  const p = usePlayer();
  const { playing, currentTime, duration } = usePlayerStatus();
  const song = lib.byId[p.currentId];
  if (!song) return null;
  const pos = duration ? currentTime / duration : 0;
  // Фон: размытая обложка песни (с затемнением, текст белый); без обложки — белая карточка
  // в светлой теме и почти чёрная серая — в тёмной.
  const cover = lib.coverUri(song);
  const mc = cover
    ? { bg: '#111113', edge: '#00000000', text: '#ffffff', sub: 'rgba(255,255,255,0.8)', track: 'rgba(255,255,255,0.25)', bar: '#ffffff' }
    : isDark
      ? { bg: '#161618', edge: '#2a2a2e', text: '#ffffff', sub: 'rgba(255,255,255,0.65)', track: 'rgba(255,255,255,0.15)', bar: '#ffffff' }
      : { bg: '#ffffff', edge: colors.border, text: colors.text, sub: colors.textMuted, track: colors.border, bar: colors.ink };
  return (
    // Сплошной цвет: голубой в светлой теме, тёмно-синий в тёмной (без градиента)
    <Pressable onPress={onOpen} style={{ backgroundColor: mc.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: mc.edge, overflow: 'hidden' }}>
      {cover ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={{ uri: cover }} blurRadius={30} resizeMode="cover" style={{ width: '100%', height: '100%', transform: [{ scale: 1.4 }] }} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} />
        </View>
      ) : null}
      <View style={{ height: 3, backgroundColor: mc.track }}>
        <View style={{ height: 3, width: `${pos * 100}%`, backgroundColor: mc.bar }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}>
        {/* Предыдущая песня — слева, перед обложкой (зеркально «Следующей» справа). */}
        <Pressable onPress={p.prev} hitSlop={10} style={{ padding: 6, marginLeft: -6, marginRight: 4 }}>
          <PrevIcon color={mc.text} size={30} />
        </Pressable>
        {/* Play/Pause — прямо на обложке: экономит место. */}
        <Pressable onPress={p.toggle} hitSlop={8}>
          <Cover song={song} size={42} radius={8} bare />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }]}>
            {playing ? <PauseIcon color="#ffffff" size={24} /> : <PlayIcon color="#ffffff" size={24} />}
          </View>
        </Pressable>
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: mc.text, fontWeight: '700', fontSize: 15, flex: 1 }} numberOfLines={1}>{song.title}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {p.snippets ? <BoltIcon color={mc.sub} size={12} style={{ marginRight: 3 }} /> : null}
            <Text style={{ color: mc.sub, fontSize: 12, flexShrink: 1 }} numberOfLines={1}>
              {p.snippets ? t('snip_mode') + ' · ' : ''}{song.artist || t('unknown_artist')}
            </Text>
          </View>
        </View>
        {p.snippets ? (
          <Pressable onPress={() => { lib.updateSong(song.id, { fav: !song.fav }); if (!song.fav) showFavToast(t('snip_liked')); }} hitSlop={10} style={{ padding: 6 }}>
            {song.fav ? <HeartIcon color={mc.text} size={26} /> : <HeartOffIcon color={mc.text} size={26} />}
          </Pressable>
        ) : null}
        <Pressable onPress={p.next} hitSlop={10} style={{ padding: 6 }}>
          <NextIcon color={mc.text} size={30} />
        </Pressable>
        <Pressable onPress={p.stop} hitSlop={10} style={{ padding: 6, marginLeft: 2 }}>
          <CloseIcon color={mc.sub} size={24} />
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
  artistChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, borderWidth: 1, borderColor: '#ffffff55', backgroundColor: '#ffffff1a', maxWidth: '100%' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5, borderColor: '#ffffff55' },
  snipBox: { marginTop: 16, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: '#ffffff40', backgroundColor: '#00000033' },
  snipBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8, borderRadius: 18, borderWidth: 1.5, borderColor: '#ffffff55' },
  bigBtn: { width: 78, height: 78, borderRadius: 39, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
});
