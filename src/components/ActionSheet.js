import React from 'react';
import { Modal, Pressable, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';

/** Нижнее меню действий: title, subtitle, items [{ label, onPress, danger }]. */
export default function ActionSheet({ visible, title, subtitle, lead, items, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
        <Pressable style={{ backgroundColor: colors.bgCard, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 10, paddingTop: 8 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 10 }} />
          {(title || lead) && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 10 }}>
              {lead}
              <View style={{ flex: 1, marginLeft: lead ? 12 : 0 }}>
                <Text style={{ color: colors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>{title}</Text>
                {subtitle ? <Text style={{ color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
            </View>
          )}
          {items.map((it, i) => (
            <Pressable key={i} onPress={() => { onClose(); setTimeout(it.onPress, 50); }}
              style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? colors.accentSoft : 'transparent', borderTopWidth: 1, borderTopColor: colors.border })}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {it.Icon ? <it.Icon color={it.danger ? colors.danger : colors.accent} size={22} style={{ marginRight: 14 }} /> : null}
                <Text style={{ fontSize: 16, fontWeight: '600', color: it.danger ? colors.danger : colors.text }}>{it.label}</Text>
              </View>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
