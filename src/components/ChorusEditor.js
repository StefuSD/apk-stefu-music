import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { fmtTime } from '../utils/format';
import { snippetRange } from '../utils/snippet';

/**
 * Припев песни: найден разбором звука на телефоне или поправлен вручную.
 * value: { start, end, manual?, conf? } или null (не найден — тогда для
 * «Только припевы» берётся середина песни). «Сейчас» — позиция плеера,
 * если играет эта песня; «Послушать» — включить её с начала припева.
 */
export default function ChorusEditor({ song, value, onChange }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const p = usePlayer();
  const { currentTime } = usePlayerStatus();
  const isCurrent = p.currentId === song.id;
  const dur = song.duration || 0;
  const [a, b] = value ? [value.start, value.end] : snippetRange(song, dur);

  const set = (start, end) => {
    let s = Math.max(0, Math.round(start * 10) / 10);
    let e = Math.round(end * 10) / 10;
    if (dur) { s = Math.min(s, dur - 3); e = Math.min(e, dur); }
    if (e < s + 3) e = s + 3;
    onChange({ start: s, end: e, manual: true });
  };
  const btn = [st.step, { borderColor: colors.border, backgroundColor: colors.bgCard }];
  const Row = ({ label, v, onStep, onNow }) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable onPress={() => onStep(-5)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>-5</Text></Pressable>
        <Pressable onPress={() => onStep(-1)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>-1</Text></Pressable>
        <View style={[st.time, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 17 }}>{fmtTime(v)}</Text>
        </View>
        <Pressable onPress={() => onStep(1)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>+1</Text></Pressable>
        <Pressable onPress={() => onStep(5)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>+5</Text></Pressable>
        {isCurrent && (
          <Pressable onPress={onNow} style={[st.step, { borderColor: colors.accent, paddingHorizontal: 10 }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('trim_now')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const status = !value ? t('chorus_none') : value.manual ? t('chorus_manual') : t('chorus_auto');
  return (
    <View style={[st.box, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}>
      <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 10 }}>
        {fmtTime(a)} – {fmtTime(b)}  <Text style={{ color: colors.textMuted, fontWeight: '500' }}>· {status}</Text>
      </Text>
      <Row label={t('chorus_start')} v={a} onStep={d => set(a + d, b + d)} onNow={() => set(currentTime, Math.max(b, currentTime + 15))} />
      <Row label={t('chorus_end')} v={b} onStep={d => set(a, b + d)} onNow={() => set(a, currentTime)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable onPress={() => (isCurrent ? p.seek(a) : p.playList([song.id], song.id, { snippets: true }))}
          style={[st.step, { borderColor: colors.accent, paddingHorizontal: 12 }]}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('chorus_listen')}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {value && value.manual ? (
          <Pressable onPress={() => onChange(null)} style={{ padding: 6 }}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('chorus_reset')}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>{t('chorus_hint')}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 12 },
  step: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, minWidth: 40, alignItems: 'center' },
  time: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minWidth: 68, alignItems: 'center' },
});
