import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { usePro } from './ProContext';
import { Icon } from '../components/icons';

/**
 * A row for Settings that opens the Pro sheet on its own, so what Pro holds
 * can be read without first running into a lock. Says "on" once Pro is there.
 * Under it, "Restore purchase" for a reinstall or a new phone, only once
 * purchases actually work.
 */
export default function ProRow({ style = null }) {
  const { openPro, isPro, canRestore, restorePro, tr, colors: c } = usePro();
  return (
    <>
    <TouchableOpacity
      style={[s.row, { borderColor: c.accent + '55', backgroundColor: c.accent + '11' }, style]}
      onPress={openPro}
      activeOpacity={0.7}
    >
      <Icon name="star" size={20} color={c.accent} />
      <View style={s.body}>
        <Text style={[s.title, { color: c.text }]}>{tr('title')}</Text>
        <Text style={[s.sub, { color: c.muted }]}>{tr(isPro ? 'rowOn' : 'rowAbout')}</Text>
      </View>
      <Text style={[s.chev, { color: c.accent }]}>›</Text>
    </TouchableOpacity>
    {canRestore && (
      <TouchableOpacity style={s.restore} onPress={restorePro} hitSlop={8}>
        <Text style={[s.restoreText, { color: c.accent }]}>{tr('restore')}</Text>
      </TouchableOpacity>
    )}
    </>
  );
}

const s = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, marginVertical: 8, borderRadius: 12, borderWidth: 1 },
  star:  { fontSize: 18 },
  body:  { flex: 1 },
  title: { fontSize: 15, fontWeight: '800' },
  sub:   { fontSize: 13, marginTop: 2 },
  chev:  { fontSize: 22, fontWeight: '700' },
  restore:     { alignSelf: 'flex-start', paddingVertical: 4, marginBottom: 8 },
  restoreText: { fontSize: 13, fontWeight: '800' },
});
