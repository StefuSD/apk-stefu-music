/**
 * Отдельная сборка для скриншотов и видео — «Music Shots».
 *
 * Снимать карточку Google Play и проверять резервную копию (сброс, импорт)
 * надо на отдельных данных, а основной Music на телефоне — рабочий:
 * в нём настоящая музыка и история прослушиваний. Стирать его ради проверки нельзя.
 *
 * Поэтому та же программа собирается вторым приложением рядом: другой
 * applicationId (`.shots`) — своя папка данных, свои настройки и своё имя
 * на рабочем столе, чтобы не перепутать. Включается свойством сборки:
 *
 *   gradlew assembleRelease -PmusicShots
 *
 * Без него сборка обычная — плагин ничего не меняет.
 */
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const MARK = '// music-shots';
const GRADLE = `
${MARK}: -PmusicShots собирает «Music Shots» рядом с основным Music (plugins/withShotsBuild.js).
if (project.hasProperty('musicShots')) {
    android.defaultConfig.applicationIdSuffix = '.shots'
    android.sourceSets.release.res.srcDirs += 'src/shots/res'
}
`;

module.exports = function withShotsBuild(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes(MARK)) cfg.modResults.contents += GRADLE;
    return cfg;
  });
  return withDangerousMod(config, ['android', async (cfg) => {
    const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'shots', 'res', 'values');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'strings.xml'),
      '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n  <string name="app_name">Music Shots</string>\n</resources>\n'
    );
    return cfg;
  }]);
};
