// Прозрачная системная панель навигации (кнопки/полоска жестов внизу телефона).
// Приложение работает edge-to-edge: нижнее меню вкладок само заходит под системную панель
// (отступ insets.bottom в App.js), поэтому подложка Android не нужна — убираем её
// (enforceNavigationBarContrast=false) и делаем фон панели прозрачным.
// Цвет значков кнопок задаётся из JS по теме (App.js, expo-navigation-bar).
const { withAndroidStyles, AndroidConfig } = require('expo/config-plugins');

module.exports = function withTransparentNavBar(config) {
  return withAndroidStyles(config, cfg => {
    const parent = { name: 'AppTheme', parent: 'Theme.AppCompat.DayNight.NoActionBar' };
    let xml = cfg.modResults;
    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true, parent, name: 'android:enforceNavigationBarContrast', value: 'false',
      targetApi: '29',
    });
    xml = AndroidConfig.Styles.assignStylesValue(xml, {
      add: true, parent, name: 'android:navigationBarColor', value: '@android:color/transparent',
    });
    cfg.modResults = xml;
    return cfg;
  });
};
