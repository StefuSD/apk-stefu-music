import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, Dimensions } from 'react-native';
import HeaderBg from './HeaderBg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { THEMES, THEME_CATEGORIES, themeName } from '../data/themes';
import AbstractArt from './AbstractArt';
import { CloseIcon, CheckIcon } from './icons';

/** Окно выбора темы фона: «Авто» и ~100 тем по разделам, плитки с превью. */
export default function ThemePicker({ visible, seed, value, variant, onPick, onClose }) {
  const { colors } = useTheme();
  const { t, lang } = useLang();
  const insets = useSafeAreaInsets();
  const W = Dimensions.get('window').width;
  const tile = Math.floor((W - 16 * 2 - 10 * 2) / 3);

  const Tile = ({ id, label }) => {
    const on = (value ?? null) === id;
    return (
      <Pressable onPress={() => { onPick(id); onClose(); }} style={{ width: tile, marginBottom: 12 }}>
        <View style={{ width: tile, height: tile * 0.8, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.ink,
          borderWidth: on ? 2.5 : 0, borderColor: colors.text }}>
          <AbstractArt seed={seed} theme={id} variant={variant} small />
          {on && (
            <View style={{ position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <CheckIcon color="#000" size={15} />
            </View>
          )}
        </View>
        <Text style={{ color: colors.text, fontSize: 12, marginTop: 5 }} numberOfLines={1}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 8 }]}>
          <HeaderBg />
          <Pressable onPress={onClose} hitSlop={10} style={[st.hBtn, { backgroundColor: colors.headerBtn }]}><CloseIcon color={colors.headerText} size={22} /></Pressable>
          <Text style={{ color: colors.headerText, fontSize: 19, fontWeight: '700', marginLeft: 12 }}>{t('f_theme')}</Text>
        </View>
        {visible && (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
            <View style={st.grid}><Tile id={null} label={t('theme_auto')} /></View>
            {THEME_CATEGORIES.map(c => (
              <View key={c.id}>
                <Text style={[st.cat, { color: colors.textMuted }]}>{lang === 'ru' || lang === 'uk' ? c.ru : c.en}</Text>
                <View style={st.grid}>
                  {THEMES.filter(x => x.cat === c.id).map(x => <Tile key={x.id} id={x.id} label={themeName(x, lang)} />)}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 },
  hBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cat: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 8 },
});
