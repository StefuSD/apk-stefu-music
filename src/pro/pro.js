import storage from './storage';

/**
 * Что входит в Pro у Stefu Music — в одном месте.
 *
 * Экраны спрашивают `canUse(feature)` (через `usePro()`), а не решают сами:
 * перенести функцию в Pro или из Pro — правка этой таблицы.
 *
 * `gatesOn` — главный выключатель. Пока он false, никто не ограничен, а
 * таблица только говорит, что будет в Pro. Переключатель разработчика
 * (7 быстрых нажатий на версию в Настройках) включает замки на одном
 * телефоне — посмотреть приложение глазами нового бесплатного пользователя.
 *
 * Бесплатно — вся музыка: библиотека, плеер, плейлисты, отчёты, Топ-20,
 * похожие, обложки, слова, виджет.
 */
export const PRO_RULES = {
  gatesOn: false,
  free: {
    snippetsDay: 20,    // сниппетов в режиме «Только сниппеты» за день
  },
  proOnly: [],
  labels: {
    snippetsDay: {
      ru: 'Сниппеты без ограничения (бесплатно — {n} в день)', en: 'Unlimited snippets (free: {n} a day)',
    },
  },
  help: {
    snippetsDay: {
      ru: 'Приложение само находит в каждой песне сниппет — самый повторяющийся и яркий кусок, обычно припев. Прямо на телефоне, без интернета. Режим «Только сниппеты» играет по 15–30 секунд каждой песни: за пару минут понятно, какие песни нравятся, не слушая их целиком. Бесплатно — {n} сниппетов в день, с Pro — сколько угодно. «К сниппету» в плеере и правка сниппета в карточке песни — бесплатно всегда.',
      en: 'The app finds the snippet in every song by itself — the most repeated, catchiest part, usually the chorus. Right on the phone, offline. "Snippets only" plays 15–30 seconds of each song: in a couple of minutes you know which songs you like without hearing them in full. Free: {n} snippets a day; with Pro, as many as you like. "To snippet" in the player and editing the snippet in the song card are always free.',
    },
  },
};

export const PRO_FEATURES = [...Object.keys(PRO_RULES.free), ...PRO_RULES.proOnly];

/*
 * The developer switch: '' as shipped, 'pro' to act as a buyer, 'free' to
 * act as a new user with the gates on. Kept apart from the app's data, so
 * neither a backup nor a reset carries it.
 */
const DEV_KEY = 'stefu_pro_dev';
// Set once Google Play confirms the purchase (billing still to come).
const OWNED_KEY = 'stefu_pro_owned';

/*
 * "I bought Pro" in the developer switch: only in a development run, or in an
 * APK bundled with EXPO_PUBLIC_PRO_DEV=1 (your own builds). A store build
 * leaves it out, and a 'pro' left on a phone by an earlier build is ignored.
 *   $env:EXPO_PUBLIC_PRO_DEV='1'; ./gradlew assembleRelease
 */
export const PRO_DEV_SWITCH =
  (typeof __DEV__ !== 'undefined' && __DEV__) || process.env.EXPO_PUBLIC_PRO_DEV === '1';

export async function readProState() {
  const [dev, owned] = await Promise.all([storage.getItem(DEV_KEY), storage.getItem(OWNED_KEY)]);
  return { dev: (dev === 'pro' && PRO_DEV_SWITCH) || dev === 'free' ? dev : '', owned: owned === '1' };
}

export async function writeProDev(dev) {
  if (dev) await storage.setItem(DEV_KEY, dev);
  else await storage.removeItem(DEV_KEY);
}

export async function writeProOwned(owned) {
  if (owned) await storage.setItem(OWNED_KEY, '1');
  else await storage.removeItem(OWNED_KEY);
}

/** Whether the limits apply on this phone at all. */
export function gatesActive({ dev }) {
  return PRO_RULES.gatesOn || dev === 'free';
}

/** Whether this phone has Pro: bought, or switched on by the developer. */
export function hasPro({ dev, owned }) {
  return dev !== 'free' && (owned || dev === 'pro');
}

export function canUse(feature, state) {
  if (!gatesActive(state) || hasPro(state)) return true;
  return !PRO_RULES.proOnly.includes(feature);
}

/** The free allowance of a counted thing, or Infinity when nothing limits it. */
export function limitOf(key, state) {
  if (!gatesActive(state) || hasPro(state)) return Infinity;
  return PRO_RULES.free[key] ?? Infinity;
}

/** A feature's note for the Pro sheet, in `lang`, English when missing. */
export function featureHelp(key, lang) {
  const h = PRO_RULES.help[key] || {};
  return (h[lang] || h.en || '').replace('{n}', String(PRO_RULES.free[key] ?? ''));
}

/** A feature's name for the Pro sheet, in `lang`, English when missing. */
export function featureLabel(key, lang) {
  const l = PRO_RULES.labels[key] || {};
  return (l[lang] || l.en || key).replace('{n}', String(PRO_RULES.free[key] ?? ''));
}
