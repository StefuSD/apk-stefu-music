import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { usePro } from './ProContext';
import { Icon } from '../components/icons';
import { featureLabel } from './pro';

/**
 * Stands in for a Pro feature while it is closed: its name with a lock, and
 * a tap that opens the Pro sheet. Renders nothing while the feature is open,
 * so a screen can always place it beside the feature itself. `lang` and
 * `colors` default to the ones `ProProvider` was given.
 */
export default function ProLock({ feature, lang, colors, style }) {
  const pro = usePro();
  const { canUse, requirePro } = pro;
  if (canUse(feature)) return null;
  lang = lang || pro.lang;
  colors = colors || pro.colors;
  return (
    <TouchableOpacity
      style={[s.row, { borderColor: colors.accent + '55', backgroundColor: colors.accent + '11' }, style]}
      onPress={() => requirePro(feature)}
      activeOpacity={0.7}
    >
      <Icon name="lock" size={16} color={colors.accent} />
      <Text style={[s.text, { color: colors.text }]} numberOfLines={2}>{featureLabel(feature, lang)}</Text>
      <Text style={[s.badge, { color: colors.accent }]}>PRO</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, marginVertical: 4, borderRadius: 12, borderWidth: 1 },
  lock:  { fontSize: 15 },
  text:  { flex: 1, fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '800' },
});
