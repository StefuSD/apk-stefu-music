/**
 * The Pro sheet's and developer switch's own words, so the module does not
 * depend on how the app keeps its translations. `{app}` is the app's name.
 * A language missing here falls back to English.
 *
 * Stefu Music sells Pro one way only: one purchase for good, no subscription.
 */
const S = {
  ru: {
    rowAbout: 'Что входит в Pro', rowOn: 'Pro включён — спасибо!',
    title: '{app} Pro', intro: 'Одна покупка навсегда, без подписки. Всё основное остаётся бесплатным. Нажмите на пункт — откроется краткая справка и ссылка, где это в приложении.',
    planLife: 'Навсегда — одна покупка', planLifeNote: 'Платите один раз, без подписки',
    restore: 'Восстановить покупку', restoreNone: 'На этом аккаунте Google покупок Pro не найдено.',
    buyError: 'Не получилось. Проверьте интернет и попробуйте ещё раз.',
    soonList: 'Что войдёт в Pro, появится в следующих версиях.',
    buy: 'Получить Pro', buySoon: 'Покупка появится в следующей версии.', notNow: 'Не сейчас', see: 'Открыть',
    devTitle: 'Режим Pro (для разработчика)',
    devText: 'Как приложение выглядит у покупателя Pro и у нового бесплатного пользователя. Только на этом телефоне.',
    devNormal: 'Как у всех', devPro: 'Я купил Pro', devFree: 'Я бесплатный',
    badgePro: 'Режим: Pro', badgeFree: 'Режим: бесплатный',
  },
  en: {
    rowAbout: "What's in Pro", rowOn: 'Pro is on — thank you!',
    title: '{app} Pro', intro: 'One purchase for good, no subscription. Everything essential stays free. Tap an item for a short note and a link to where it is in the app.',
    planLife: 'Forever — one purchase', planLifeNote: 'Pay once, no subscription',
    restore: 'Restore purchase', restoreNone: 'No Pro purchase found on this Google account.',
    buyError: "That didn't work. Check the internet connection and try again.",
    soonList: 'What Pro holds will arrive in coming versions.',
    buy: 'Get Pro', buySoon: 'Buying will arrive in the next version.', notNow: 'Not now', see: 'Open',
    devTitle: 'Pro mode (developer)',
    devText: 'How the app looks to a Pro buyer and to a new free user. This phone only.',
    devNormal: 'As shipped', devPro: 'I bought Pro', devFree: 'I am free',
    badgePro: 'Mode: Pro', badgeFree: 'Mode: free',
  },
};

export function proStrings(lang, app) {
  const table = { ...S.en, ...(S[String(lang || '').slice(0, 2)] || {}) };
  return key => (table[key] || key).replace('{app}', app);
}
