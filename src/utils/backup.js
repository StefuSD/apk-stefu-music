// Автокопия истории прослушиваний и списка песен в папку вне приложения (обычно «Загрузки»):
// переживает удаление приложения и сброс его данных. Папку выбирают один раз (доступ Android SAF),
// дальше копия пишется сама раз в неделю. Хранятся KEEP последних файлов stefu-music-backup-ГГГГ-ММ-ДД.json.
// Восстановление — LibraryContext.importHistory (принимает и этот файл, и ручной «Экспорт»).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const SAF = FileSystem.StorageAccessFramework;
const K_DIR = 'sm_bak_dir';
const K_AT = 'sm_bak_at';
const K_N = 'sm_bak_n';       // сколько прослушиваний было в прошлой копии
const WEEK = 7 * 24 * 3600 * 1000;
const KEEP = 4;
const PREFIX = 'stefu-music-backup-';

export async function backupInfo() {
  const [dir, at] = await Promise.all([AsyncStorage.getItem(K_DIR), AsyncStorage.getItem(K_AT)]);
  return { dir, at: at ? Number(at) : null };
}

/** Выбрать папку для копий (по умолчанию открывается «Загрузки»). null — отказались. */
export async function chooseBackupDir() {
  const perm = await SAF.requestDirectoryPermissionsAsync(SAF.getUriForDirectoryInRoot('Download'));
  if (!perm.granted) return null;
  await AsyncStorage.setItem(K_DIR, perm.directoryUri);
  return perm.directoryUri;
}

const nameOf = uri => decodeURIComponent(uri).split('/').pop();

/** Записать копию сейчас: файл за сегодня перезаписывается, старше KEEP последних — удаляются. */
export async function writeBackup(data) {
  const dir = await AsyncStorage.getItem(K_DIR);
  if (!dir) throw new Error('no folder');
  const name = PREFIX + new Date().toISOString().slice(0, 10);
  const ours = (await SAF.readDirectoryAsync(dir)).filter(u => nameOf(u).startsWith(PREFIX));
  const today = ours.find(u => nameOf(u).startsWith(name));
  const uri = today || await SAF.createFileAsync(dir, name, 'application/json');
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(data));
  const all = (today ? ours : [...ours, uri]).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  for (const old of all.slice(0, Math.max(0, all.length - KEEP))) {
    await FileSystem.deleteAsync(old, { idempotent: true }).catch(() => {});
  }
  await AsyncStorage.multiSet([[K_AT, String(Date.now())], [K_N, String((data.plays || []).length)]]);
}

/** Раз в неделю — копия сама. Пропуск, если история вдруг стала вдвое меньше прошлой копии
 *  (похоже на сбой — хорошие копии не вытесняем). */
export async function maybeAutoBackup(getData) {
  const [[, dir], [, at], [, n]] = await AsyncStorage.multiGet([K_DIR, K_AT, K_N]);
  if (!dir || (at && Date.now() - Number(at) < WEEK)) return false;
  const data = getData();
  const cnt = (data.plays || []).length;
  if (!cnt || (n && cnt < Number(n) * 0.5)) return false;
  await writeBackup(data);
  return true;
}
