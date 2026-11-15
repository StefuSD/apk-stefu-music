/**
 * Быстрые кнопки на иконке приложения (App Shortcuts): долгое нажатие на иконку
 * Stefu Music → «Микс для вас», «Вперемешку», «Сниппеты», «Таймер сна».
 *
 * Каждая кнопка открывает ссылку приложения <пакет>://mix и т. п. — её выполняет
 * src/links/LinkHandler.js, как и ссылки от ассистента и виджетов.
 *
 * Пакет и схема у «Music Shots» свои (com.stefu.music.shots, plugins/withShotsBuild.js),
 * поэтому у него свой shortcuts.xml в src/shots/res — он перекрывает основной.
 *
 * Подписи — на языке телефона (так Android показывает ярлыки), из переводов приложения
 * src/i18n: короткая (for_you, shuffle, snip_short, sleep) и длинная (h_mix, … + «30 мин»).
 *
 * Запуск без prebuild: node plugins/withShortcuts.js — пишет всё прямо в android/.
 */
const fs = require('fs');
const path = require('path');

const ACTIONS = [
  { id: 'mix', link: 'mix', icon: 'sparkle', short: 'for_you', long: 'h_mix' },
  { id: 'shuffle', link: 'shuffle', icon: 'shuffle', short: 'shuffle', long: 'shuffle' },
  { id: 'snippets', link: 'snippets', icon: 'bolt', short: 'snip_short', long: 'snip_short' },
  { id: 'sleep', link: 'sleep?min=30', icon: 'moon', short: 'sleep', long: 'sleep', min: 30 },
];
const ICONS = {
  sparkle: 'M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z',
  shuffle: 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  moon: 'M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96z',
};
const LILAC = '#7b3fcf';   // как фон заставки (assets/mk_icon.py → SPLASH_BG)

// Значок ярлыка по правилам Android: круг 48 dp, белый силуэт 24 dp в центре.
const iconXml = d => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp" android:height="48dp" android:viewportWidth="48" android:viewportHeight="48">
  <path android:fillColor="${LILAC}" android:pathData="M24,0A24,24 0 1,1 24,48A24,24 0 1,1 24,0Z"/>
  <group android:translateX="12" android:translateY="12">
    <path android:fillColor="#FFFFFF" android:pathData="${d}"/>
  </group>
</vector>
`;

const shortcutsXml = pkg => `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${ACTIONS.map(a => `  <shortcut android:shortcutId="${a.id}" android:enabled="true" android:icon="@drawable/ic_shortcut_${a.id}"
      android:shortcutShortLabel="@string/shortcut_${a.id}_short" android:shortcutLongLabel="@string/shortcut_${a.id}_long">
    <intent android:action="android.intent.action.VIEW" android:data="${pkg}://${a.link.replace(/&/g, '&amp;')}"
        android:targetPackage="${pkg}" android:targetClass="com.stefu.music.MainActivity"/>
  </shortcut>`).join('\n')}
</shortcuts>
`;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/'/g, "\\'").replace(/"/g, '\\"');

/** Переводы приложения: { ru: {...}, en: {...}, de: {...}, … } (index.js — ru и en, locales/*.js — остальные). */
function loadDicts(projectRoot) {
  const dir = path.join(projectRoot, 'src', 'i18n');
  const grab = (src, keys) => {
    const out = {};
    for (const k of keys) {
      const m = src.match(new RegExp(`\\b${k}: '((?:[^'\\\\]|\\\\.)*)'`));
      if (m) out[k] = m[1].replace(/\\'/g, "'");
    }
    return out;
  };
  const keys = ['for_you', 'h_mix', 'shuffle', 'snip_short', 'sleep', 'min_short'];
  const index = fs.readFileSync(path.join(dir, 'index.js'), 'utf8');
  const ruEnd = index.indexOf('\nconst en = {');
  const dicts = { ru: grab(index.slice(0, ruEnd), keys), en: grab(index.slice(ruEnd), keys) };
  for (const f of fs.readdirSync(path.join(dir, 'locales'))) {
    if (f.endsWith('.js')) dicts[f.replace('.js', '')] = grab(fs.readFileSync(path.join(dir, 'locales', f), 'utf8'), keys);
  }
  return dicts;
}

function stringsXml(d, en) {
  const t = k => d[k] || en[k];
  const lines = [];
  for (const a of ACTIONS) {
    const long = a.min ? `${t(a.long)} · ${a.min} ${t('min_short')}` : t(a.long);
    lines.push(`  <string name="shortcut_${a.id}_short">${esc(t(a.short))}</string>`);
    lines.push(`  <string name="shortcut_${a.id}_long">${esc(long)}</string>`);
  }
  return `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${lines.join('\n')}\n</resources>\n`;
}

/** Записать ярлыки в android/ (androidRoot — папка android, projectRoot — корень проекта). */
function writeShortcuts(androidRoot, projectRoot) {
  const res = path.join(androidRoot, 'app', 'src', 'main', 'res');
  const shotsRes = path.join(androidRoot, 'app', 'src', 'shots', 'res');
  const pkg = 'com.stefu.music';
  for (const [dir, p] of [[res, pkg], [shotsRes, pkg + '.shots']]) {
    fs.mkdirSync(path.join(dir, 'xml'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'xml', 'shortcuts.xml'), shortcutsXml(p));
  }
  fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
  for (const a of ACTIONS) fs.writeFileSync(path.join(res, 'drawable', `ic_shortcut_${a.id}.xml`), iconXml(ICONS[a.icon]));
  const dicts = loadDicts(projectRoot);
  for (const [lang, d] of Object.entries(dicts)) {
    const folder = lang === 'en' ? 'values' : `values-${lang}`;
    fs.mkdirSync(path.join(res, folder), { recursive: true });
    fs.writeFileSync(path.join(res, folder, 'shortcuts_strings.xml'), stringsXml(d, dicts.en));
  }
}

/** Подключить ярлыки к MainActivity в манифесте (объект манифеста expo или текст). */
function addMeta(main) {
  main['meta-data'] = main['meta-data'] || [];
  if (!main['meta-data'].some(m => m.$['android:name'] === 'android.app.shortcuts')) {
    main['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
  }
}

module.exports = function withShortcuts(config) {
  const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
  config = withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find(a => a.$['android:name'] === '.MainActivity');
    if (main) addMeta(main);
    return cfg;
  });
  return withDangerousMod(config, ['android', async (cfg) => {
    writeShortcuts(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectRoot);
    return cfg;
  }]);
};
module.exports.writeShortcuts = writeShortcuts;

// node plugins/withShortcuts.js — без prebuild: файлы и строка в манифесте прямо в android/.
if (require.main === module) {
  const root = path.join(__dirname, '..');
  writeShortcuts(path.join(root, 'android'), root);
  const mf = path.join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
  let txt = fs.readFileSync(mf, 'utf8');
  if (!txt.includes('android.app.shortcuts')) {
    txt = txt.replace(/(<activity android:name="\.MainActivity"[^>]*>)/, '$1\n      <meta-data android:name="android.app.shortcuts" android:resource="@xml/shortcuts"/>');
    fs.writeFileSync(mf, txt);
  }
  console.log('ok');
}
