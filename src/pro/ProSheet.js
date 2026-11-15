import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { PRO_FEATURES, featureLabel, featureHelp } from './pro';
import { getPrices, buy, BILLING_READY } from './billing';
import { navRef } from '../navigation/navRef';

/*
 * Where each feature lives, for the "Open" link under its note: a tab of the
 * navigator, and for Settings the tab of the page.
 */
const WHERE = {
  snippetsDay: ['Music'],
};

const PLANS = ['life'];
const PLAN_KEY = { life: 'planLife' };

/**
 * What Pro adds, opened when someone reaches for a closed feature.
 *
 * One way to have it in Stefu Music: one purchase for good. Each
 * feature is a line that opens to a short note and a link to the screen
 * where it lives. The feature that was reached for is listed first, marked
 * and already open, so the sheet answers "why did this open" before it says
 * anything else. `feature` null keeps it closed; 'any' opens it without a
 * reason, from Settings.
 *
 * Prices and the purchase come from ./billing. Until Google Play billing is
 * wired there are no prices, the cards show the plans without them and the
 * button says buying is on its way. `onOwned` is called once paid.
 */
export default function ProSheet({ feature, onClose, onOwned, tr, lang, colors }) {
  const [openKey, setOpenKey] = React.useState(null);
  const [plan, setPlan] = React.useState('life');
  const [prices, setPrices] = React.useState({});
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setOpenKey(PRO_FEATURES.includes(feature) ? feature : null); }, [feature]);
  React.useEffect(() => {
    if (feature) getPrices().then(p => setPrices(p || {})).catch(() => {});
  }, [!!feature]);
  if (!feature) return null;
  const c = colors;
  const list = PRO_FEATURES.includes(feature) ? [feature, ...PRO_FEATURES.filter(k => k !== feature)] : PRO_FEATURES;
  const go = k => {
    const w = WHERE[k];
    if (!w || !navRef.isReady()) return;
    onClose();
    // A nonce, so Settings switches to the tab even when it is already open.
    navRef.navigate(w[0], w[0] === 'Settings' ? { ...w[1], nonce: Date.now() } : w[1]);
  };
  const onBuy = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await buy(plan);
      if (r.ok) { onOwned && onOwned(); onClose(); Alert.alert(tr('title'), tr('rowOn')); }
      else if (r.reason === 'unavailable') Alert.alert(tr(PLAN_KEY[plan]), tr('buySoon'));
      else if (r.reason !== 'cancelled') Alert.alert(tr('title'), tr('buyError'));
    } catch {
      Alert.alert(tr('title'), tr('buyError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <ScrollView>
            <Text style={[s.title, { color: c.text }]}>{tr('title')}</Text>
            <Text style={[s.intro, { color: c.muted }]}>{tr('intro')}</Text>
            {list.length ? list.map(k => {
              const open = openKey === k;
              const help = featureHelp(k, lang);
              return (
                <View key={k} style={[s.item, k === feature && { backgroundColor: c.accent + '22' }]}>
                  <TouchableOpacity style={s.row} onPress={() => setOpenKey(open ? null : k)} activeOpacity={0.7}
                    accessibilityRole="button" accessibilityState={{ expanded: open }}>
                    <Text style={[s.mark, { color: c.accent }]}>✓</Text>
                    <Text style={[s.text, { color: c.accent }]}>{featureLabel(k, lang)}</Text>
                    <Text style={[s.chev, { color: c.accent }]}>{open ? '▴' : '▾'}</Text>
                  </TouchableOpacity>
                  {open && (
                    <View style={s.help}>
                      {help ? <Text style={[s.helpText, { color: c.muted }]}>{help}</Text> : null}
                      {WHERE[k] && (
                        <TouchableOpacity style={s.link} onPress={() => go(k)} hitSlop={8}>
                          <Text style={[s.linkText, { color: c.accent }]}>{tr('see')} →</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            }) : <Text style={[s.intro, { color: c.muted }]}>{tr('soonList')}</Text>}
            {/* Plans and the buy button only once purchases work: a button
                that cannot buy gets the app turned down by the store. */}
            {BILLING_READY && (
              <>
                <View style={s.plans}>
                  {PLANS.map(p => {
                    const on = plan === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[s.plan, { borderColor: c.muted + '55' }, on && { borderColor: c.accent, backgroundColor: c.accent + '11' }]}
                        onPress={() => setPlan(p)}
                        activeOpacity={0.8}
                      >
                        <View style={[s.radio, { borderColor: on ? c.accent : c.muted }]}>
                          {on && <View style={[s.radioDot, { backgroundColor: c.btn || c.accent, borderWidth: 1, borderColor: c.btnBorder || c.accent }]} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.planTitle, { color: c.text }]}>{tr(PLAN_KEY[p])}</Text>
                          <Text style={[s.planNote, { color: c.muted }]}>{tr(PLAN_KEY[p] + 'Note')}</Text>
                        </View>
                        {!!prices[p] && <Text style={[s.planPrice, { color: c.text }]}>{prices[p]}</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={[s.buy, { backgroundColor: c.btn || c.accent, borderWidth: 1, borderColor: c.btnBorder || c.accent }, busy && { opacity: 0.6 }]} onPress={onBuy} disabled={busy}>
                  <Text style={[s.buyText, { color: c.onBtn || c.onAccent || '#fff' }]}>{tr('buy')}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={s.later} onPress={onClose}>
              <Text style={[s.laterText, { color: c.muted }]}>{tr('notNow')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  sheet:     { borderRadius: 16, borderWidth: 1, padding: 20, maxHeight: '85%' },
  title:     { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  intro:     { fontSize: 15, lineHeight: 21, marginBottom: 12 },
  item:      { borderRadius: 8 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8 },
  mark:      { fontSize: 15, fontWeight: '800', width: 18, textAlign: 'center' },
  // The names, bold in the app's colour: each one opens its note.
  text:      { flex: 1, fontSize: 15, fontWeight: '800' },
  chev:      { fontSize: 14, fontWeight: '800' },
  help:      { paddingLeft: 8 + 18 + 8, paddingRight: 8, paddingBottom: 10 },
  helpText:  { fontSize: 13, lineHeight: 19 },
  link:      { alignSelf: 'flex-start', marginTop: 6 },
  linkText:  { fontSize: 13, fontWeight: '800' },
  plans:     { marginTop: 16, gap: 8 },
  plan:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  radio:     { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot:  { width: 8, height: 8, borderRadius: 4 },
  planTitle: { fontSize: 15, fontWeight: '800' },
  planNote:  { fontSize: 11, marginTop: 2 },
  planPrice: { fontSize: 15, fontWeight: '800' },
  buy:       { marginTop: 12, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buyText:   { fontSize: 17, fontWeight: '800' },
  later:     { alignItems: 'center', padding: 12 },
  laterText: { fontSize: 15, fontWeight: '700' },
});
