import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { fmtTime } from '../utils/format';

const FADES = [0, 2, 3, 5, 8];
const STEPS = [-5, -1, 1, 5];

/**
 * Обрезка начала/конца и плавные начало/конец песни.
 * value: { trimStart, trimEnd, fadeIn, fadeOut } в секундах; trimEnd 0 — до конца файла.
 * «Сейчас» берёт позицию плеера, если играет именно эта песня.
 */
export default function TrimEditor({ song, value, onChange }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const p = usePlayer();
  const { currentTime } = usePlayerStatus();
  const isCurrent = p.currentId === song.id;
  const dur = song.duration || 0;
  const end = value.trimEnd || dur;

  const setStart = (v) => {
    const max = (end || Infinity) - 1;
    onChange({ ...value, trimStart: Math.max(0, Math.min(Math.round(v), max)) });
  };
  const setEnd = (v) => {
    let e = Math.round(v);
    if (dur) e = Math.min(e, dur);
    e = Math.max(e, (value.trimStart || 0) + 1);
    onChange({ ...value, trimEnd: dur && e >= dur ? 0 : e });
  };

  const btn = [st.step, { borderColor: colors.border, backgroundColor: colors.bgCard }];
  const Row = ({ label, shown, onStep, onNow }) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {STEPS.slice(0, 2).map(d => (
          <Pressable key={d} onPress={() => onStep(d)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>{d}</Text></Pressable>
        ))}
        <View style={[st.time, { backgroundColor: colors.accentSoft }]}>
          <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 17 }}>{shown}</Text>
        </View>
        {STEPS.slice(2).map(d => (
          <Pressable key={d} onPress={() => onStep(d)} style={btn}><Text style={{ color: colors.text, fontWeight: '700' }}>+{d}</Text></Pressable>
        ))}
        {isCurrent && (
          <Pressable onPress={onNow} style={[st.step, { borderColor: colors.accent, paddingHorizontal: 10 }]}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>{t('trim_now')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const Fade = ({ label, k }) => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 6 }}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {FADES.map(v => {
          const on = (value[k] || 0) === v;
          return (
            <Pressable key={v} onPress={() => onChange({ ...value, [k]: v })}
              style={[st.step, on ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
              <Text style={{ color: on ? colors.onAccent : colors.text, fontWeight: '700' }}>{v ? v + ' ' + t('sec_short') : t('fade_off')}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const changed = value.trimStart || value.trimEnd || value.fadeIn || value.fadeOut;
  return (
    <View style={[st.box, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}>
      <Row label={t('trim_start')} shown={fmtTime(value.trimStart || 0)}
        onStep={d => setStart((value.trimStart || 0) + d)} onNow={() => setStart(currentTime)} />
      <Row label={t('trim_end')} shown={end ? fmtTime(end) : '–:––'}
        onStep={d => setEnd((end || 0) + d)} onNow={() => setEnd(currentTime)} />
      <Fade label={t('fade_in')} k="fadeIn" />
      <Fade label={t('fade_out')} k="fadeOut" />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1, lineHeight: 17 }}>{t('trim_hint')}</Text>
        {changed ? (
          <Pressable onPress={() => onChange({ trimStart: 0, trimEnd: 0, fadeIn: 0, fadeOut: 0 })} style={{ padding: 6, marginLeft: 8 }}>
            <Text style={{ color: colors.danger, fontWeight: '700' }}>{t('trim_reset')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 14, padding: 12 },
  step: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 7, minWidth: 40, alignItems: 'center' },
  time: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, minWidth: 68, alignItems: 'center' },
});
