import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLang } from '../i18n';

/** Окно с одним полем ввода (Alert.prompt на Android нет). onDone(текст). */
export default function PromptDialog({ visible, title, value = '', placeholder, okLabel, onDone, onClose }) {
  const { colors } = useTheme();
  const { t } = useLang();
  const [v, setV] = useState(value);
  useEffect(() => { if (visible) setV(value); }, [visible]);
  const ok = () => { if (!v.trim()) return; onDone(v.trim()); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={[st.back, { backgroundColor: colors.overlay }]}>
        <Pressable style={[st.card, { backgroundColor: colors.bgCard }]}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          <TextInput value={v} onChangeText={setV} placeholder={placeholder} placeholderTextColor={colors.textMuted}
            autoFocus onSubmitEditing={ok} returnKeyType="done"
            style={[st.input, { backgroundColor: colors.bgInput, color: colors.text, borderColor: colors.border }]} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 14, gap: 8 }}>
            <Pressable onPress={onClose} style={st.btn}>
              <Text style={{ color: colors.textMuted, fontWeight: '600' }}>{t('cancel')}</Text>
            </Pressable>
            <Pressable onPress={ok} disabled={!v.trim()} style={[st.btn, { backgroundColor: colors.accent, opacity: v.trim() ? 1 : 0.5 }]}>
              <Text style={{ color: colors.onAccent, fontWeight: '700' }}>{okLabel || t('save')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  back: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { borderRadius: 18, padding: 18 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, marginTop: 12 },
  btn: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
});
