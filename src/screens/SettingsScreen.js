import React, { useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, Switch, Alert, Modal, ActivityIndicator, ToastAndroid } from 'react-native';
import HeaderBg from '../components/HeaderBg';
import { LIGHT, DARK, LILAC, APP_THEMES } from '../context/ThemeContext';
import { APP_THEME_SPECS, appThemeName } from '../data/appThemes';
import { usePlayer } from '../context/PlayerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { useLang, LANG_NAMES } from '../i18n';
import { useLibrary } from '../context/LibraryContext';
import { fmtSize } from '../utils/format';
import { GearIcon, CloseIcon } from '../components/icons';
import ProRow from '../pro/ProRow';
import { useProDevTaps } from '../pro/ProContext';

const XFADES = [0, 2, 4, 6, 8, 12];
const TAG_W = [0, 1, 2, 3];

/** Веса тегов для «Похожих» и «Микса»: ×0 — тег не учитывать, ×3 — главный. */
function TagWeights({ visible, onClose }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: insets.bottom }}>
        <View style={{ backgroundColor: colors.bgHeader, paddingTop: insets.top + 10, paddingBottom: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
          <HeaderBg />
          <Pressable onPress={onClose} hitSlop={10}><CloseIcon color={colors.headerText} size={24} /></Pressable>
          <Text style={{ color: colors.headerText, fontSize: 19, fontWeight: '700', marginLeft: 12 }}>{t('tw_title')}</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 30 }}>
          <Text style={{ color: colors.textMuted, lineHeight: 19, marginBottom: 12 }}>{t('tw_hint')}</Text>
          {lib.allTags.length === 0 ? <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 20 }}>{t('tw_none')}</Text> : null}
          {lib.allTags.map(tg => {
            const w = lib.tagWeights[tg] != null ? lib.tagWeights[tg] : 1;
            return (
              <View key={tg} style={[st.twRow, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                <Text style={{ flex: 1, color: w === 0 ? colors.textMuted : colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{tg}</Text>
                {TAG_W.map(v => (
                  <Pressable key={v} onPress={() => lib.setTagWeight(tg, v)}
                    style={[st.twBtn, v === w ? { backgroundColor: colors.ink } : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}>
                    <Text style={{ color: v === w ? colors.onInk : colors.text, fontWeight: '700' }}>×{v}</Text>
                  </Pressable>
                ))}
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
import pkg from '../../package.json';

export default function SettingsScreen() {
  const { colors, setMode } = useTheme();
  const { t, lang, setLang } = useLang();
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const total = lib.songs.reduce((a, s) => a + (s.size || 0), 0);
  const player = usePlayer();
  const devTaps = useProDevTaps();
  const [twOpen, setTwOpen] = useState(false);
  const [covers, setCovers] = useState(null);   // { n, m, found } пока ищем обложки
  const stopCovers = useRef(false);
  const noCover = lib.songs.filter(s => !s.cover).length;
  const withSound = lib.songs.filter(s => s.sound).length;

  const findAllCovers = async () => {
    stopCovers.current = false;
    setCovers({ n: 0, m: noCover, found: 0 });
    try {
      const r = await lib.findCovers(setCovers, () => stopCovers.current);
      Alert.alert('', t('covers_done', { n: r.found, m: r.total }));
    } catch (e) { Alert.alert('', String(e?.message || e)); }
    setCovers(null);
  };

  const loadSound = async () => {
    try {
      const r = await lib.importSound();
      if (r) Alert.alert('', t('sound_done', { n: r.matched, m: r.total }));
    } catch (e) { Alert.alert('', t('sound_bad') + '\n' + String(e?.message || e)); }
  };

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
      <Text style={{ flex: 1, fontSize: 15, color: danger ? colors.danger : colors.text, fontWeight: '700' }}>{label}</Text>
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
        <HeaderBg />
        <GearIcon color={colors.headerText} size={26} />
        <Text style={{ color: colors.headerText, fontSize: 20, fontWeight: '600', marginLeft: 10, letterSpacing: 0.3 }}>{t('nav_settings')}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 30 }}>
        <ProRow style={{ marginTop: 6, marginBottom: 0 }} />
        <Section title={t('s_look')}>
          {/* Тема: обычные (светлая, тёмная, «Сирень») и тематические оформления — плитки с превью шапки */}
          <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{t('s_theme')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[[LIGHT, t('s_theme_light')], [DARK, t('s_theme_night')], [LILAC, t('s_theme_lilac')],
                ...APP_THEMES.map((th, i) => [th, appThemeName(APP_THEME_SPECS[i], lang)])].map(([th, label]) => {
                const on = colors.mode === th.mode;
                return (
                  <Pressable key={th.mode} onPress={() => setMode(th.mode)} style={{ width: '31.5%' }}>
                    <View style={{ height: 46, borderRadius: 10, overflow: 'hidden', backgroundColor: th.bgHeader,
                      borderWidth: on ? 2.5 : 1, borderColor: on ? colors.ink : colors.border, justifyContent: 'flex-end' }}>
                      <HeaderBg theme={th} />
                      <View style={{ height: 12, backgroundColor: th.bg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 4 }}>
                        <View style={{ width: 14, height: 5, borderRadius: 3, backgroundColor: th.ink }} />
                        <View style={{ width: 8, height: 5, borderRadius: 3, backgroundColor: th.accent }} />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 4, color: on ? colors.text : colors.textMuted, fontWeight: on ? '700' : '500' }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 10 }}>{t('s_lang')}</Text>
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
        <Section title={t('s_play')}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>{t('xfade')}</Text>
            <Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 3, marginBottom: 10, lineHeight: 18 }}>{t('xfade_hint')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {XFADES.map(v => (
                <Pressable key={v} onPress={() => player.setCrossfade(v)}
                  style={[st.pill, player.crossfade === v ? { backgroundColor: colors.ink, borderWidth: 1, borderColor: colors.ink } : { borderWidth: 1, borderColor: colors.border }]}>
                  <Text style={{ color: player.crossfade === v ? colors.onInk : colors.text, fontWeight: '600' }}>{v ? `${v} ${t('sec_short')}` : t('fade_off')}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Section>
        <Section title={t('s_similar')}>
          <Row label={t('tw_title')} onPress={() => setTwOpen(true)}
            right={<Text style={{ color: colors.textMuted }}>{Object.keys(lib.tagWeights).length || ''}</Text>} />
          <Row label={t('sound_load')} onPress={loadSound} last
            right={<Text style={{ color: colors.textMuted }}>{withSound ? `${withSound}/${lib.songs.length}` : ''}</Text>} />
          <Text style={{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 17 }}>{t('sound_hint')}</Text>
        </Section>
        {lib.canAnalyze ? (
          <Section title={t('an_title')}>
            {lib.analysis ? (
              <View style={[st.row, { flexDirection: 'row', alignItems: 'center' }]}>
                <ActivityIndicator color={colors.accent} />
                <Text style={{ flex: 1, marginLeft: 12, color: colors.text, fontWeight: '700' }}>{t('an_progress', lib.analysis)}</Text>
              </View>
            ) : (
              <Row label={t('an_redo')} onPress={() => Alert.alert('', t('an_redo_q'), [
                { text: t('cancel'), style: 'cancel' },
                { text: t('an_redo'), onPress: lib.reanalyzeAll },
              ])} last right={<Text style={{ color: colors.textMuted }}>{`${lib.songs.filter(s => s.chorus).length}/${lib.songs.length}`}</Text>} />
            )}
            <Text style={{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 17 }}>{t('an_hint')}</Text>
          </Section>
        ) : null}
        <Section title={t('f_cover')}>
          {covers ? (
            <View style={[st.row, { flexDirection: 'row', alignItems: 'center' }]}>
              <ActivityIndicator color={colors.accent} />
              <Text style={{ flex: 1, marginLeft: 12, color: colors.text, fontWeight: '700' }}>{t('covers_progress', covers)}</Text>
              <Pressable onPress={() => { stopCovers.current = true; }} hitSlop={10}>
                <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('stop')}</Text>
              </Pressable>
            </View>
          ) : (
            <Row label={t('covers_find_all')} onPress={noCover ? findAllCovers : undefined} last
              right={<Text style={{ color: colors.textMuted }}>{noCover}</Text>} />
          )}
          <Text style={{ fontSize: 12, color: colors.textMuted, paddingHorizontal: 14, paddingBottom: 12, lineHeight: 17 }}>{t('covers_hint')}</Text>
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
            <Pressable onPress={devTaps.onPress}>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>
                {t('s_version', { v: pkg.version })}{devTaps.badge ? ' · ' + devTaps.badge : ''}
              </Text>
            </Pressable>
          </View>
        </Section>
      </ScrollView>
      <TagWeights visible={twOpen} onClose={() => setTwOpen(false)} />
    </View>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14 },
  sec: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 6, marginBottom: 6 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14 },
  pill: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  twRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  twBtn: { width: 40, paddingVertical: 6, borderRadius: 10, alignItems: 'center' },
});
