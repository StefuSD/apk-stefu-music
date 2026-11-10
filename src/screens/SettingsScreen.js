import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useLang, LANG_NAMES } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { fmtSize } from '../utils/format';
import { GearIcon } from '../components/icons';
import pkg from '../../package.json';

export default function SettingsScreen() {
  const { colors, isDark, toggle } = useTheme();
  const { t, lang, setLang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const total = lib.songs.reduce((a, s) => a + (s.size || 0), 0);

  const exportJson = async () => {
    try {
      const data = {
        app: 'Stefu Music', version: pkg.version, exportedAt: new Date().toISOString(),
        songs: lib.songs.map(({ file, cover, ...s }) => s),
        plays: lib.plays.map(p => ({ song: p.s, start: new Date(p.t).toISOString(), seconds: p.d, counted: !!p.c })),
      };
      const uri = FileSystem.cacheDirectory + 'stefu-music-' + new Date().toISOString().slice(0, 10) + '.json';
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(data, null, 2));
      await Sharing.shareAsync(uri, { mimeType: 'application/json' });
    } catch (e) { Alert.alert('', String(e?.message || e)); }
  };

  const confirm = (msg, fn) => Alert.alert('', msg, [
    { text: t('cancel'), style: 'cancel' },
    { text: t('delete'), style: 'destructive', onPress: fn },
  ]);

  const Row = ({ label, onPress, right, danger, last }) => (
    <Pressable onPress={onPress} disabled={!onPress}
      style={({ pressed }) => [st.row, { borderColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? colors.accentSoft : 'transparent' }]}>
      <Text style={{ flex: 1, fontSize: 15, color: danger ? colors.danger : colors.text, fontWeight: onPress ? '600' : '400' }}>{label}</Text>
      {right}
    </Pressable>
  );
  const Section = ({ title, children }) => (
    <View style={{ marginTop: 18 }}>
      <Text style={[st.sec, { color: colors.accent }]}>{title}</Text>
      <View style={[st.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>{children}</View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[st.header, { backgroundColor: colors.bgHeader, paddingTop: insets.top + 10 }]}>
        <GearIcon color={colors.headerText} size={26} />
        <Text style={{ color: colors.headerText, fontSize: 20, fontWeight: '600', marginLeft: 10, letterSpacing: 0.3 }}>{t('nav_settings')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
        <Section title={t('s_look')}>
          <Row label={t('s_theme_dark')} right={<Switch value={isDark} onValueChange={toggle} trackColor={{ true: colors.accent }} thumbColor="#fff" />} />
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 15, color: colors.text, marginBottom: 10 }}>{t('s_lang')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Object.keys(LANG_NAMES).map(l => (
                <Pressable key={l} onPress={() => setLang(l)}
                  style={[st.pill, lang === l ? { backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink } : { borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ color: lang === l ? colors.onInk : colors.text, fontWeight: '500' }}>{LANG_NAMES[l]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>
        <Section title={t('s_library')}>
          <Row label={t('s_stats', { n: lib.songs.length, size: fmtSize(total) })} />
          <Row label={t('s_export')} onPress={exportJson} />
          <Row label={t('s_clear_history')} danger onPress={() => confirm(t('s_clear_history_q'), lib.clearHistory)} />
          <Row label={t('s_clear_all')} danger last onPress={() => confirm(t('s_clear_all_q'), lib.clearAll)} />
        </Section>
        <Section title={t('s_about')}>
          <View style={{ padding: 14 }}>
            <Text style={{ color: colors.text, lineHeight: 21 }}>{t('s_about_text')}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 10 }}>{t('s_support')}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>{t('s_version', { v: pkg.version })}</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14 },
  sec: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 6, marginBottom: 6 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
});
