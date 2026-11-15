/**
 * Ссылки в приложение: <пакет>://play?q=…, ://reports и другие (src/links/links.js).
 * Их открывает Stefu Assistant, ярлыки и любые другие программы.
 *
 * Схема — сам applicationId: Gradle подставляет ${applicationId} в манифест,
 * поэтому у основного приложения схема com.stefu.music, у «Music Shots»
 * (-PmusicShots, plugins/withShotsBuild.js) — com.stefu.music.shots.
 * Общая схема у двух приложений рядом заставляла бы Android спрашивать,
 * чем открыть ссылку. Так же сделано в Stefu Contacts.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const MARK = '${applicationId}';

module.exports = function withLinks(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find(a => a.$['android:name'] === '.MainActivity');
    if (!main) return cfg;
    main['intent-filter'] = main['intent-filter'] || [];
    const has = main['intent-filter'].some(f => (f.data || []).some(d => d.$['android:scheme'] === MARK));
    if (!has) {
      main['intent-filter'].push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        category: [
          { $: { 'android:name': 'android.intent.category.DEFAULT' } },
          { $: { 'android:name': 'android.intent.category.BROWSABLE' } },
        ],
        data: [{ $: { 'android:scheme': MARK } }],
      });
    }
    return cfg;
  });
};
