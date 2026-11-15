import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePro } from './ProContext';
import { Icon } from '../components/icons';
import { featureLabel } from './pro';

/**
 * A whole screen standing in for closed content: what is closed, a button
 * that opens the Pro sheet, and one that goes back. For a screen that has
 * nothing to show without Pro (a lesson, a story); a row inside a screen
 * takes `ProLock` instead.
 */
export default function ProWall({ feature, onBack }) {
  const { showPro, tr, lang, colors: c } = usePro();
  return (
    <View style={[s.root, { backgroundColor: c.card }]}>
      <Icon name="lock" size={40} color={c.accent} style={{ marginBottom: 12 }} />
      <Text style={[s.title, { color: c.text }]}>{featureLabel(feature, lang)}</Text>
      <Text style={[s.intro, { color: c.muted }]}>{tr('title')}</Text>
      <TouchableOpacity style={[s.buy, { backgroundColor: c.btn || c.accent, borderWidth: 1, borderColor: c.btnBorder || c.accent }]} onPress={() => showPro(feature)}>
        <Text style={[s.buyText, { color: c.onBtn || c.onAccent || '#fff' }]}>{tr('buy')}</Text>
      </TouchableOpacity>
      {onBack ? (
        <TouchableOpacity style={s.back} onPress={onBack}>
          <Text style={[s.backText, { color: c.muted }]}>{tr('notNow')}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * A navigator screen behind Pro. `check(params, pro)` names the feature that
 * closes this particular opening (a B1 story, say), or returns null to let
 * it through — so every way of reaching the screen is covered at once,
 * including paging with `setParams`.
 */
export function withProGate(Screen, check) {
  function Gated(props) {
    const pro = usePro();
    const feature = pro.gated && !pro.isPro ? check(props.route?.params || {}, pro) : null;
    if (feature && !pro.canUse(feature)) {
      return <ProWall feature={feature} onBack={() => props.navigation.goBack()} />;
    }
    return <Screen {...props} />;
  }
  Gated.displayName = `Pro(${Screen.displayName || Screen.name || 'Screen'})`;
  return Gated;
}

const s = StyleSheet.create({
  root:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  lock:     { fontSize: 44, marginBottom: 14 },
  title:    { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 6 },
  intro:    { fontSize: 15, textAlign: 'center', marginBottom: 22 },
  buy:      { alignSelf: 'stretch', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buyText:  { fontSize: 17, fontWeight: '800' },
  back:     { padding: 14 },
  backText: { fontSize: 15, fontWeight: '700' },
});
