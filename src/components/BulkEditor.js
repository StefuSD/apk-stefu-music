import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, StyleSheet, ToastAndroid } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { SONG_LANGS, langName } from '../utils/languages';
import { CloseIcon, PlusIcon } from './icons';

/**
 * Правка сразу нескольких песен: добавить или убрать теги и языки, задать
 * жанр, год, избранное. Пустые поля и «не менять» ничего не трогают.
 * Меняются записи в приложении; сами файлы MP3 не переписываются.
 */
export default function BulkEditor({ ids, onClose, onDone }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const [addTags, setAddTags] = useState([]);
  const [delTags, setDelTags] = useState([]);
  const [addLangs, setAddLangs] = useState([]);
  const [delLangs, setDelLangs] = useState([]);
  const [newTag, setNewTag] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [fav, setFav] = useState(null);   // null — не менять, true/false
  const visible = !!(ids && ids.length);

  useEffect(() => {
    if (!visible) return;
    setAddTags([]); setDelTags([]); setAddLangs([]); setDelLangs([]); setNewTag(''); setGenre(''); setYear(''); setFav(null);
  }, [visible]);

  const sel = useMemo(() => (ids || []).map(id => lib.byId[id]).filter(Boolean), [ids, lib.byId]);
  const theirTags = useMemo(() => [...new Set(sel.flatMap(s => s.tags || []))], [sel]);
  const theirLangs = useMemo(() => [...new Set(sel.flatMap(s => s.langs || []))], [sel]);
  const toggleIn = (arr, set, v) => set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const addNewTag = () => {
    const v = newTag.trim().replace(/^#+/, '');
    if (v && !addTags.includes(v)) setAddTags([...addTags, v]);
    setNewTag('');
  };

  const apply = () => {
    const g = genre.trim(), y = year.trim();
    lib.updateSongs(ids, s => {
      const p = {};
      if (addTags.length || delTags.length) {
        p.tags = [...new Set([...(s.tags || []).filter(x => !delTags.includes(x)), ...addTags])];
      }
      if (addLangs.length || delLangs.length) {
        p.langs = [...new Set([...(s.langs || []).filter(x => !delLangs.includes(x)), ...addLangs])];
      }
      if (g) p.genre = g;
      if (y) p.year = y;
      if (fav != null) p.fav = fav;
      return p;
    });
    ToastAndroid.show(t('bulk_done', { n: ids.length }), ToastAndroid.SHORT);
    onDone && onDone();
    onClose();
  };

  const chip = (label, on, onPress, key, minus) => (
    <Pressable key={key || label} onPress={onPress}
      style={[st.chip, on ? { backgroundColor: minus ? colors.danger : colors.ink, borderColor: minus ? colors.danger : colors.ink } : { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
      <Text style={{ color: on ? colors.onInk : colors.text, fontWeight: '600', fontSize: 13 }}>{(on ? (minus ? '− ' : '+ ') : '') + label}</Text>
    </Pressable>
  );
  const Label = ({ k }) => <Text style={[st.label, { color: colors.textMuted }]}>{t(k)}</Text>;
  const input = [st.input, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ backgroundColor: colors.bgHeader, paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={onClose} hitSlop={10}><CloseIcon color={colors.headerText} size={24} /></Pressable>
          <Text style={{ color: colors.headerText, fontSize: 19, fontWeight: '700', marginLeft: 12, flex: 1 }}>{t('bulk_title', { n: (ids || []).length })}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: colors.textMuted, lineHeight: 19 }}>{t('bulk_hint')}</Text>

          <Label k="bulk_add_tags" />
          <View style={st.wrap}>
            {[...new Set([...lib.allTags, ...addTags])].map(tg => chip(tg, addTags.includes(tg), () => toggleIn(addTags, setAddTags, tg), 'a' + tg))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <TextInput value={newTag} onChangeText={setNewTag} onSubmitEditing={addNewTag} placeholder={t('tag_add')}
              placeholderTextColor={colors.textMuted} style={[input, { flex: 1 }]} />
            <Pressable onPress={addNewTag} style={[st.plus, { backgroundColor: colors.ink }]}><PlusIcon color={colors.onInk} size={22} /></Pressable>
          </View>

          {theirTags.length > 0 && (<>
            <Label k="bulk_del_tags" />
            <View style={st.wrap}>{theirTags.map(tg => chip(tg, delTags.includes(tg), () => toggleIn(delTags, setDelTags, tg), 'd' + tg, true))}</View>
          </>)}

          <Label k="bulk_add_langs" />
          <View style={st.wrap}>
            {SONG_LANGS.map(l => chip(langName(l.code, lang), addLangs.includes(l.code), () => toggleIn(addLangs, setAddLangs, l.code), 'l' + l.code))}
          </View>
          {theirLangs.length > 0 && (<>
            <Label k="bulk_del_langs" />
            <View style={st.wrap}>{theirLangs.map(l => chip(langName(l, lang), delLangs.includes(l), () => toggleIn(delLangs, setDelLangs, l), 'x' + l, true))}</View>
          </>)}

          <Label k="f_genre" />
          <TextInput value={genre} onChangeText={setGenre} placeholder={t('bulk_keep')} placeholderTextColor={colors.textMuted} style={input} />
          <Label k="f_year" />
          <TextInput value={year} onChangeText={setYear} placeholder={t('bulk_keep')} placeholderTextColor={colors.textMuted} keyboardType="number-pad" style={input} />

          <Label k="favorites" />
          <View style={st.wrap}>
            {chip(t('bulk_keep'), fav === null, () => setFav(null), 'f0')}
            {chip(t('bulk_fav_on'), fav === true, () => setFav(true), 'f1')}
            {chip(t('bulk_fav_off'), fav === false, () => setFav(false), 'f2')}
          </View>
        </ScrollView>
        <View style={{ padding: 12, paddingBottom: insets.bottom + 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.bgCard }}>
          <Pressable onPress={apply} style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.onAccent, fontWeight: '700', fontSize: 16 }}>{t('bulk_apply', { n: (ids || []).length })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 20, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  plus: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
});
