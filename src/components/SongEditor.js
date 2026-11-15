import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Image, Linking } from 'react-native';
import { SONG_LANGS, langName, toLangCode, normalizeUrl } from '../utils/languages';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { ToastAndroid } from 'react-native';
import { useTheme, tagColor } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary, COVERS_DIR } from '../context/LibraryContext';
import { fmtDate, fmtSize, fmtTime } from '../utils/format';
import Cover from './Cover';
import ActionSheet from './ActionSheet';
import TrimEditor from './TrimEditor';
import ChorusEditor from './ChorusEditor';

import AbstractArt, { resolveTheme } from './AbstractArt';
import ThemePicker from './ThemePicker';
import CoverFromUrl from './CoverFromUrl';
import CoverSearch from './CoverSearch';
import { openCoverSearch } from '../utils/coverWeb';
import { embedTags } from '../utils/shareSong';
import { themeName } from '../data/themes';
import { artistsOf, joinArtists } from '../utils/artists';
import { CloseIcon, TrashIcon, PlusIcon, HeartIcon, HeartOffIcon, ImageIcon, LyricsIcon, LanguageIcon, VideoIcon, CheckIcon, ScissorsIcon, LinkIcon, SearchIcon } from './icons';

// Название и исполнитель — главное в песне: их поля крупнее и жирные.
const FIELDS = [{ k: 'album' }, { k: 'genre' }, { k: 'year' }];

export default function SongEditor({ song, onClose }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const [f, setF] = useState(null);
  const [newTag, setNewTag] = useState('');
  // Обложка: undefined — не трогали, null — убрать, строка — новый файл (uri из галереи).
  const [cover, setCover] = useState(undefined);
  const [coverMenu, setCoverMenu] = useState(false);
  const [newLang, setNewLang] = useState('');
  const [themeOpen, setThemeOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);


  useEffect(() => {
    if (song) {
      setF({ title: song.title, artists: artistsOf(song).length ? [...artistsOf(song)] : [''], album: song.album, genre: song.genre, year: song.year,
        note: song.note || '', lyrics: song.lyrics || '', tags: [...(song.tags || [])], fav: !!song.fav,
        langs: [...(song.langs || [])], videoUrl: song.videoUrl || '',
        artTheme: song.artTheme ?? null, artVariant: song.artVariant || 0,
        trim: { trimStart: song.trimStart || 0, trimEnd: song.trimEnd || 0, fadeIn: song.fadeIn || 0, fadeOut: song.fadeOut || 0 },
        chorus: song.chorus || null, chorusTouched: false });
    }
    setNewTag('');
    setNewLang('');
    setCover(undefined);
  }, [song?.id]);

  if (!song || !f) return null;
  const set = (k, v) => setF(o => ({ ...o, [k]: v }));
  const addTag = (raw) => {
    const tg = raw.trim().replace(/^#+/, '').toLowerCase();
    if (tg && !f.tags.includes(tg)) set('tags', [...f.tags, tg]);
    setNewTag('');
  };

  const toggleLang = (code) => set('langs', f.langs.includes(code) ? f.langs.filter(x => x !== code) : [...f.langs, code]);
  const addLang = () => {
    const c = toLangCode(newLang);
    if (c && !f.langs.includes(c)) set('langs', [...f.langs, c]);
    setNewLang('');
  };
  const openVideo = () => {
    const u = normalizeUrl(f.videoUrl);
    if (u) Linking.openURL(u).catch(() => Alert.alert('', t('video_bad', { u })));
  };

  // Слова из буфера одним нажатием (заменяют то, что было в поле).
  const pasteLyrics = async () => {
    try {
      const txt = (await Clipboard.getStringAsync() || '').replace(/\r\n?/g, '\n').trim();
      if (txt) set('lyrics', txt);
      else ToastAndroid.show(t('clipboard_empty'), ToastAndroid.SHORT);
    } catch (e) { ToastAndroid.show(t('clipboard_empty'), ToastAndroid.SHORT); }
  };

  const pickCover = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (!r.canceled && r.assets?.[0]?.uri) setCover(r.assets[0].uri);
    } catch (e) { Alert.alert('', String(e?.message || e)); }
  };

  const save = async () => {
    const pending = newTag.trim().replace(/^#/, '').toLowerCase();
    const tags = pending && !f.tags.includes(pending) ? [...f.tags, pending] : f.tags;
    const patch = {
      title: f.title.trim() || song.title,
      artists: f.artists.map(x => x.trim()).filter(Boolean), artist: joinArtists(f.artists), album: f.album.trim(),
      genre: f.genre.trim(), year: f.year.trim(), note: f.note, lyrics: f.lyrics.trim(), tags, fav: f.fav,
      langs: (() => { const c = toLangCode(newLang); return c && !f.langs.includes(c) ? [...f.langs, c] : f.langs; })(),
      videoUrl: normalizeUrl(f.videoUrl),
      artTheme: f.artTheme, artVariant: f.artVariant,
      ...f.trim,
    };
    // Припев: ручной — как задан; «Сбросить» — заново найдёт разбор звука.
    if (f.chorusTouched) {
      patch.chorus = f.chorus;
      if (!f.chorus) patch.av = 0;
    }
    if (cover !== undefined) {
      if (song.cover) FileSystem.deleteAsync(COVERS_DIR + song.cover, { idempotent: true }).catch(() => {});
      patch.cover = null;
      if (cover) {
        // Новое имя файла при каждой смене — иначе картинка останется старой в кэше.
        const name = song.id + '-' + Date.now().toString(36) + '.jpg';
        try { await FileSystem.copyAsync({ from: cover, to: COVERS_DIR + name }); patch.cover = name; }
        catch (e) { Alert.alert('', String(e?.message || e)); }
      }
    }
    lib.updateSong(song.id, patch);
    onClose();
    // Поля и обложку — ещё и в сам файл MP3 (в фоне, окно уже закрыто).
    const merged = { ...song, ...patch };
    embedTags(merged, { songUri: lib.songUri(merged), coverUri: lib.coverUri(merged) }).catch(() => {});
  };
  const del = () => Alert.alert('', t('delete_q', { t: song.title }), [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: () => { lib.deleteSongs([song.id]); onClose(); } },
  ]);
  const suggestions = lib.allTags.filter(x => !f.tags.includes(x)).slice(0, 20);
  const input = [st.input, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }];
  const hasCover = cover === undefined ? !!song.cover : !!cover;
  // Поиск картинок в браузере по тому, что сейчас вписано в поля.
  const coverWeb = () => openCoverSearch(joinArtists(f.artists) || song.artist, f.title.trim() || song.title);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={10} style={[st.hBtn, { backgroundColor: colors.headerBtn }]}><CloseIcon color={colors.headerText} size={22} /></Pressable>
          <Text style={{ color: colors.headerText, fontSize: 19, fontWeight: '700', flex: 1, marginLeft: 12 }}>{t('edit_song')}</Text>
          <Pressable onPress={del} hitSlop={10} style={[st.hBtn, { backgroundColor: colors.headerBtn }]}><TrashIcon color={colors.headerText} size={22} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
            <Pressable onPress={() => setCoverMenu(true)}>
              {cover ? <Image source={{ uri: cover }} style={{ width: 84, height: 84, borderRadius: 14 }} />
                : cover === null ? <Cover song={{ ...song, cover: null }} size={84} radius={14} />
                : <Cover song={song} size={84} radius={14} />}
              <View style={[st.coverBadge, { backgroundColor: colors.accent, borderColor: colors.bg }]}>
                <ImageIcon color={colors.onAccent} size={15} />
              </View>
            </Pressable>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Pressable onPress={() => setCoverMenu(true)}>
                <Text style={{ color: colors.accent, fontWeight: '700', marginBottom: 4 }}>{t(hasCover ? 'cover_change' : 'cover_pick')}</Text>
              </Pressable>
              <Pressable onPress={coverWeb} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 4 }}>
                <SearchIcon color={colors.accent} size={14} />
                <Text style={{ color: colors.accent, fontWeight: '700', marginLeft: 4 }}>{t('cover_web')}</Text>
              </Pressable>
              <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={2}>{song.origName}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                {t('song_info', { d: fmtDate(song.addedAt, lang), size: fmtSize(song.size) })}{song.duration ? ' · ' + fmtTime(song.duration) : ''}
              </Text>
              <Text style={{ color: colors.accent, fontSize: 12, marginTop: 2, fontWeight: '700' }}>{t('plays_n', { n: lib.playCount[song.id] || 0 })}</Text>
            </View>
            <Pressable onPress={() => set('fav', !f.fav)} hitSlop={10} style={{ padding: 6 }}>
              {f.fav ? <HeartIcon color={colors.accent} size={28} /> : <HeartOffIcon color={colors.textMuted} size={30} />}
            </Pressable>
          </View>

          {/* Тема фона — только у песни без обложки (фон полного плеера). */}
          {!hasCover && (
            <View style={{ marginBottom: 16 }}>
              <Text style={[st.label, { color: colors.textMuted }]}>{t('f_theme')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Pressable onPress={() => setThemeOpen(true)}
                  style={{ width: 96, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.ink }}>
                  <AbstractArt seed={song.id} theme={f.artTheme} variant={f.artVariant} small />
                </Pressable>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                    {f.artTheme ? themeName(resolveTheme(song.id, f.artTheme), lang) : t('theme_auto') + ' · ' + themeName(resolveTheme(song.id, null), lang)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                    <Pressable onPress={() => setThemeOpen(true)} hitSlop={6}>
                      <Text style={{ color: colors.accent, fontWeight: '600' }}>{t('theme_pick')}</Text>
                    </Pressable>
                    <Pressable onPress={() => set('artVariant', (f.artVariant || 0) + 1)} hitSlop={6}>
                      <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('theme_shuffle')}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
              <ThemePicker visible={themeOpen} seed={song.id} value={f.artTheme} variant={f.artVariant}
                onPick={id => set('artTheme', id)} onClose={() => setThemeOpen(false)} />
            </View>
          )}
          <View style={{ marginBottom: 12 }}>
            <Text style={[st.label, { color: colors.textMuted }]}>{t('f_title')}</Text>
            <TextInput value={f.title} onChangeText={v => set('title', v)} style={[input, { fontWeight: '700', fontSize: 18 }]} maxLength={200} />
          </View>
          <Text style={[st.label, { color: colors.textMuted }]}>{t('f_artists')}</Text>
          {f.artists.map((a, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <TextInput value={a} onChangeText={v => set('artists', f.artists.map((x, j) => (j === i ? v : x)))}
                placeholder={t('f_artist')} placeholderTextColor={colors.textMuted}
                style={[input, { flex: 1, fontWeight: '700', fontSize: 18 }]} maxLength={200} />
              {f.artists.length > 1 && (
                <Pressable onPress={() => set('artists', f.artists.filter((_, j) => j !== i))} hitSlop={8} style={{ padding: 10 }}>
                  <CloseIcon color={colors.textMuted} size={20} />
                </Pressable>
              )}
            </View>
          ))}
          <Pressable onPress={() => set('artists', [...f.artists, ''])}
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 12 }}>
            <PlusIcon color={colors.text} size={18} />
            <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 6 }}>{t('artist_add')}</Text>
          </Pressable>
          {FIELDS.map(({ k, strong }) => (
            <View key={k} style={{ marginBottom: 12 }}>
              <Text style={[st.label, { color: colors.textMuted }]}>{t('f_' + k)}</Text>
              <TextInput value={f[k]} onChangeText={v => set(k, v)}
                style={[input, strong && { fontWeight: '700', fontSize: 18 }]}
                keyboardType={k === 'year' ? 'number-pad' : 'default'} maxLength={k === 'year' ? 4 : 200}
                placeholderTextColor={colors.textMuted} />
            </View>
          ))}

          <Text style={[st.label, { color: colors.textMuted }]}>{t('f_tags')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {f.tags.map(tg => (
              <Pressable key={tg} onPress={() => set('tags', f.tags.filter(x => x !== tg))}
                style={[st.chip, { backgroundColor: colors.ink, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={{ color: colors.onInk, fontWeight: '500' }}>{tg}</Text>
                <CloseIcon color={colors.onInk} size={14} style={{ marginLeft: 4 }} />
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput value={newTag} onChangeText={v => (/[,\n]/.test(v) ? addTag(v.replace(/[,\n]/g, '')) : setNewTag(v))}
              onSubmitEditing={() => addTag(newTag)} blurOnSubmit={false} placeholder={t('tag_hint')}
              placeholderTextColor={colors.textMuted} style={[input, { flex: 1 }]} returnKeyType="done" />
            <Pressable onPress={() => addTag(newTag)} style={[st.addBtn, { backgroundColor: colors.accent }]}>
              <PlusIcon color={colors.onAccent} size={24} />
            </Pressable>
          </View>
          {suggestions.length > 0 && (
            <>
              <Text style={[st.label, { color: colors.textMuted, marginTop: 10 }]}>{t('tags_existing')}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {suggestions.map(tg => (
                  <Pressable key={tg} onPress={() => addTag(tg)} style={[st.chip, { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.textMuted }]}>
                    <Text style={{ color: colors.textMuted, fontWeight: '500' }}>+ {tg}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
            <LanguageIcon color={colors.textMuted} size={16} />
            <Text style={[st.label, { color: colors.textMuted, marginBottom: 0, marginLeft: 6 }]}>{t('f_langs')}</Text>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[...SONG_LANGS.map(l => l.code), ...f.langs.filter(c => !SONG_LANGS.some(l => l.code === c))].map(code => {
              const on = f.langs.includes(code);
              return (
                <Pressable key={code} onPress={() => toggleLang(code)}
                  style={[st.chip, { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
                    on ? { backgroundColor: colors.ink, borderColor: colors.ink } : { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                  {on ? <CheckIcon color={colors.onInk} size={14} style={{ marginRight: 4 }} /> : null}
                  <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: '500' }}>{langName(code, lang)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={newLang} onChangeText={setNewLang} onSubmitEditing={addLang} blurOnSubmit={false}
              placeholder={t('lang_other')} placeholderTextColor={colors.textMuted} style={[input, { flex: 1 }]} returnKeyType="done" />
            <Pressable onPress={addLang} style={[st.addBtn, { backgroundColor: colors.accent }]}>
              <PlusIcon color={colors.onAccent} size={24} />
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 5 }}>
            <VideoIcon color={colors.textMuted} size={16} />
            <Text style={[st.label, { color: colors.textMuted, marginBottom: 0, marginLeft: 6 }]}>{t('f_video')}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TextInput value={f.videoUrl} onChangeText={v => set('videoUrl', v)} placeholder={t('video_hint')}
              placeholderTextColor={colors.textMuted} style={[input, { flex: 1 }]}
              keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            {f.videoUrl.trim() ? (
              <Pressable onPress={openVideo} style={[st.addBtn, { backgroundColor: colors.accent, width: undefined, paddingHorizontal: 14, flexDirection: 'row' }]}>
                <VideoIcon color={colors.onAccent} size={20} />
                <Text style={{ color: colors.onAccent, fontWeight: '700', marginLeft: 6 }}>{t('video_open')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
            <ScissorsIcon color={colors.textMuted} size={16} />
            <Text style={[st.label, { color: colors.textMuted, marginBottom: 0, marginLeft: 6 }]}>{t('f_trim')}</Text>
          </View>
          <TrimEditor song={song} value={f.trim} onChange={v => set('trim', v)} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 6 }}>
            <LyricsIcon color={colors.textMuted} size={16} />
            <Text style={[st.label, { color: colors.textMuted, marginBottom: 0, marginLeft: 6 }]}>{t('f_chorus')}</Text>
          </View>
          <ChorusEditor song={song} value={f.chorus} onChange={v => setF(x => ({ ...x, chorus: v, chorusTouched: true }))} />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 5 }}>
            <LyricsIcon color={colors.textMuted} size={16} />
            <Text style={[st.label, { color: colors.textMuted, marginBottom: 0, marginLeft: 6, flex: 1 }]}>{t('f_lyrics')}</Text>
            <Pressable onPress={pasteLyrics} hitSlop={6} style={[st.miniBtn, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>{t('lyrics_paste')}</Text>
            </Pressable>
            {f.lyrics ? (
              <Pressable onPress={() => set('lyrics', '')} hitSlop={6} style={[st.miniBtn, { borderColor: colors.border, backgroundColor: colors.bgCard, marginLeft: 8 }]}>
                <Text style={{ color: colors.danger, fontWeight: '600', fontSize: 13 }}>{t('lyrics_clear')}</Text>
              </Pressable>
            ) : null}
          </View>
          <TextInput value={f.lyrics} onChangeText={v => set('lyrics', v)} multiline placeholder={t('lyrics_hint')}
            placeholderTextColor={colors.textMuted}
            style={[input, { minHeight: 160, textAlignVertical: 'top', lineHeight: 22 }]} />

          <Text style={[st.label, { color: colors.textMuted, marginTop: 14 }]}>{t('f_note')}</Text>
          <TextInput value={f.note} onChangeText={v => set('note', v)} multiline style={[input, { minHeight: 70, textAlignVertical: 'top' }]} />

        </ScrollView>
        {/* «Сохранить» всегда внизу экрана, над системной навигацией — не надо листать форму до конца. */}
        <View style={[st.footer, { backgroundColor: colors.bgCard, borderTopColor: colors.border, paddingBottom: insets.bottom + 10 }]}>
          <Pressable onPress={save} style={({ pressed }) => [st.save, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16 }}>{t('save')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      <ActionSheet visible={coverMenu} title={t('f_cover')} onClose={() => setCoverMenu(false)}
        items={[
          { label: t('cover_find'), Icon: SearchIcon, onPress: () => setFindOpen(true) },
          { label: t('cover_web'), Icon: SearchIcon, onPress: coverWeb },
          { label: t('cover_pick'), Icon: ImageIcon, onPress: pickCover },
          { label: t('cover_url'), Icon: LinkIcon, onPress: () => setUrlOpen(true) },
          ...(hasCover ? [{ label: t('cover_remove'), Icon: TrashIcon, danger: true, onPress: () => setCover(null) }] : []),
        ]} />
      <CoverFromUrl visible={urlOpen} onDone={uri => setCover(uri)} onClose={() => setUrlOpen(false)} />
      <CoverSearch visible={findOpen} onDone={uri => setCover(uri)} onClose={() => setFindOpen(false)}
        title={(f && f.title) || song.title}
        artist={((f && f.artists) || artistsOf(song)).filter(Boolean).join(' ')} />
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  hBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  addBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  save: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  miniBtn: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  coverBadge: { position: 'absolute', right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
