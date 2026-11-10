const { withAppBuildGradle } = require('expo/config-plugins');

// Подпись release ключом загрузки Google Play — общим для приложений Stefu
// (инструкция «00-ИНСТРУКЦИЯ-запуск-в-Google-Play», B1–B3). prebuild --clean
// пересоздаёт android/, поэтому подпись задаётся здесь, а не руками.
//
// Пароли не в проекте: Gradle берёт их из gradle.properties в домашней
// папке Gradle (D:\gradle-home) или из окружения:
//   STEFU_UPLOAD_STORE_PASSWORD=...
//   STEFU_UPLOAD_KEY_PASSWORD=...
//
// Пока файла ключа нет (D:\keys\stefu-upload.keystore), release
// подписывается отладочным ключом, как раньше: сборки для телефона
// работают, а для Google Play подпись включится сама, как только ключ
// появится. Сборка «Music Shots» всегда отладочная — в Play она не идёт.
const KEY = 'D:/keys/stefu-upload.keystore';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, mod => {
    let gradle = mod.modResults.contents;
    if (gradle.includes('stefuUpload')) return mod;
    gradle = gradle.replace(
      /(signingConfigs \{\s*\n)/,
      `$1        stefuUpload {
            storeFile file("${KEY}")
            storePassword findProperty("STEFU_UPLOAD_STORE_PASSWORD") ?: System.getenv("STEFU_UPLOAD_STORE_PASSWORD")
            keyAlias "stefu-upload"
            keyPassword findProperty("STEFU_UPLOAD_KEY_PASSWORD") ?: System.getenv("STEFU_UPLOAD_KEY_PASSWORD")
        }
`
    );
    gradle = gradle.replace(
      /(release \{\s*\n(?:[^\n]*\n)*?\s*)signingConfig signingConfigs\.debug/,
      `$1signingConfig((file("${KEY}").exists() && !project.hasProperty("musicShots")) ? signingConfigs.stefuUpload : signingConfigs.debug)`
    );
    mod.modResults.contents = gradle;
    return mod;
  });
};
