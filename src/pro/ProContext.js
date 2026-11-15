import React from 'react';
import { Alert } from 'react-native';
import { readProState, writeProDev, writeProOwned, canUse as canUseRule, limitOf, hasPro, gatesActive, PRO_DEV_SWITCH } from './pro';
import { proStrings } from './strings';
import ProSheet from './ProSheet';
import { BILLING_READY, restore as restoreBilling } from './billing';

const ProContext = React.createContext({
  isPro: true, gated: false, dev: '',
  canUse: _feature => true, limit: _key => Infinity,
  requirePro: _feature => true, requireRoom: (_key, _count) => true,
  openPro: () => {}, showPro: _feature => {}, setDev: () => {}, setOwned: () => {},
  canRestore: false, restorePro: () => {}, tr: k => k, lang: 'en', colors: null,
});

/**
 * Pro for the screens: what is open, and the sheet that explains Pro when
 * someone reaches for a closed feature.
 *
 * `requirePro(feature)` and `requireRoom(key, count)` are what an action
 * calls before it goes ahead: true — go on; false — the sheet is already up,
 * stop. While the gates are off both are always true. `showPro(feature)`
 * opens the sheet on a feature whatever its state, for a button that offers Pro.
 * `setOwned` records a purchase (or a restore) that found Pro on the account;
 * `restorePro` asks the store and says what it found, and `canRestore` is
 * whether to offer it at all (only once billing works, and not to a buyer).
 *
 * `lang` and `colors` ({ card, text, soft?, muted, accent, border, onAccent? }) come from the
 * app, which mounts this inside its own language and theme providers.
 * `onChange` is told when Pro is switched, for anything drawn outside React
 * (widgets). Both `lang` and `colors` are handed on to the screens, so a
 * `ProLock` needs nothing but its feature.
 */
export function ProProvider({ appName, lang, colors, onChange = null, children }) {
  const [state, setState] = React.useState({ dev: '', owned: false });
  const [sheet, setSheet] = React.useState(null);
  const tr = React.useMemo(() => proStrings(lang, appName), [lang, appName]);

  React.useEffect(() => { readProState().then(setState).catch(() => {}); }, []);

  const value = React.useMemo(() => {
    const canUse = f => canUseRule(f, state);
    const limit = k => limitOf(k, state);
    return {
      isPro: hasPro(state),
      gated: gatesActive(state),
      dev: state.dev,
      canUse,
      limit,
      requirePro: f => { if (canUse(f)) return true; setSheet(f); return false; },
      requireRoom: (k, count) => { if (count < limit(k)) return true; setSheet(k); return false; },
      openPro: () => setSheet('any'),
      showPro: f => setSheet(f || 'any'),
      // A purchase or a restore found Pro on this account.
      setOwned: async owned => {
        await writeProOwned(owned);
        setState(s => ({ ...s, owned }));
        onChange?.();
      },
      canRestore: BILLING_READY && !hasPro(state),
      restorePro: async () => {
        try {
          const r = await restoreBilling();
          if (r.owned) {
            await writeProOwned(true);
            setState(s => ({ ...s, owned: true }));
            onChange?.();
            Alert.alert(tr('title'), tr('rowOn'));
          } else {
            Alert.alert(tr('restore'), tr('restoreNone'));
          }
        } catch {
          Alert.alert(tr('restore'), tr('buyError'));
        }
      },
      setDev: async dev => {
        await writeProDev(dev);
        setState(s => ({ ...s, dev }));
        onChange?.();
      },
      tr,
      lang,
      colors,
    };
  }, [state, tr, onChange, lang, colors]);

  return (
    <ProContext.Provider value={value}>
      {children}
      <ProSheet
        feature={sheet}
        onClose={() => setSheet(null)}
        onOwned={() => value.setOwned(true)}
        tr={tr}
        lang={lang}
        colors={colors}
      />
    </ProContext.Provider>
  );
}

export function usePro() {
  return React.useContext(ProContext);
}

/**
 * The developer's Pro switch, for a line every user can see but nobody taps
 * on purpose — the version in Settings. Returns the `onPress` to give it, and
 * a badge to show beside it while a mode is on.
 */
export function useProDevTaps() {
  const pro = usePro();
  const taps = React.useRef({ n: 0, at: 0 });
  const onPress = React.useCallback(() => {
    const now = Date.now();
    const v = taps.current;
    v.n = now - v.at < 600 ? v.n + 1 : 1;
    v.at = now;
    if (v.n < 7) return;
    v.n = 0;
    Alert.alert(pro.tr('devTitle'), pro.tr('devText'), [
      { text: pro.tr('devNormal'), onPress: () => pro.setDev('') },
      ...(PRO_DEV_SWITCH ? [{ text: pro.tr('devPro'), onPress: () => pro.setDev('pro') }] : []),
      { text: pro.tr('devFree'),   onPress: () => pro.setDev('free') },
    ]);
  }, [pro]);
  const badge = pro.dev ? pro.tr(pro.dev === 'pro' ? 'badgePro' : 'badgeFree') : '';
  return { onPress, badge };
}
