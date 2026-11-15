import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ActivityIndicator, StyleSheet, Image, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { searchCovers, downloadImage } from '../utils/coverSearch';
import { SearchIcon } from './icons';

/**
 * Окно «Найти обложку в интернете»: строка поиска (исполнитель и название
 * песни) и плитки найденных обложек. Тап — картинка скачивается и
 * отдаётся в onDone(uri) как файл.
 */
export default function CoverSearch({ visible, artist, title, onDone, onClose }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [list, setList] = useState(null);
  const [err, setErr] = useState('');
  const [taking, setTaking] = useState(null);

  const run = async (text, a = '', ti = '') => {
    setBusy(true); setErr(''); setList(null);
    try {
      const r = a || ti ? await searchCovers(a, ti) : await searchCovers('', text);
      setList(r.slice(0, 12));
      if (!r.length) setErr(t('cover_find_none'));
    } catch (e) { setErr(t('cover_find_net')); }
    setBusy(false);
  };

  useEffect(() => {
    if (!visible) return;
    const s = [artist, title].filter(Boolean).join(' ');
    setQ(s); setTaking(null);
    if (s) run(s, artist, title); else setList([]);
  }, [visible]);

  const take = async (x) => {
    setTaking(x.url);
    try {
      const r = await downloadImage(x.url) || await downloadImage(x.thumb);
      if (!r) { setErr(t('cover_url_bad')); setTaking(null); return; }
      onDone(r.uri);
      onClose();
    } catch (e) { setErr(t('cover_find_net')); setTaking(null); }
  };

  const W = Dimensions.get('window').width - 40 - 36;
  const cell = Math.floor((W - 16) / 3);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={[st.back, { backgroundColor: colors.overlay }]}>
        <Pressable style={[st.card, { backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{t('cover_find')}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 }}>{t('cover_find_hint')}</Text>
          <View style={[st.input, { backgroundColor: colors.bgInput, borderColor: colors.border }]}>
            <TextInput value={q} onChangeText={setQ} onSubmitEditing={() => run(q)} returnKeyType="search"
              placeholder={t('f_artist') + ' ' + t('f_title')} placeholderTextColor={colors.textMuted}
              style={{ flex: 1, color: colors.text, fontSize: 15, paddingVertical: 9 }} />
            <Pressable onPress={() => run(q)} hitSlop={10}><SearchIcon color={colors.textMuted} size={22} /></Pressable>
          </View>
          <ScrollView style={{ maxHeight: 420, marginTop: 12 }} contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {busy ? <ActivityIndicator color={colors.accent} style={{ margin: 30, alignSelf: 'center', flex: 1 }} /> : null}
            {(list || []).map(x => (
              <Pressable key={x.thumb} onPress={() => take(x)} disabled={!!taking} style={{ width: cell }}>
                <View>
                  <Image source={{ uri: x.thumb }} style={{ width: cell, height: cell, borderRadius: 10, backgroundColor: colors.bgInput }} />
                  {taking === x.url ? (
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0006', borderRadius: 10 }]}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  ) : null}
                </View>
                <Text style={{ color: colors.text, fontSize: 11, fontWeight: '700', marginTop: 3 }} numberOfLines={1}>{x.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11 }} numberOfLines={1}>{x.artist}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {err ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 8 }}>{err}</Text> : null}
          <Pressable onPress={onClose} style={{ alignSelf: 'flex-end', marginTop: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
            <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { borderRadius: 18, padding: 18 },
  input: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 12 },
});
