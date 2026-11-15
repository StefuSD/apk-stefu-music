import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { artistsOf } from '../utils/artists';
import { deviceLang } from '../i18n';

/**
 * Данные для виджетов на рабочем столе.
 *
 * Пока приложение в памяти, всё берётся «вживую»: global.__stefuWidget (плеер, PlayerContext)
 * и global.__stefuWidgetData (списки и статистика, WidgetSync). Каждое обновление заодно
 * сохраняется в AsyncStorage — когда Android будит обработчик без приложения, виджеты
 * рисуются по последнему снимку.
 */
export const K_WIDGET = 'sm_widget';      // текущая песня: { id, title, artist, cover, fav, duration }
export const K_WDATA = 'sm_wdata';        // { top, playlists, stats }

// Пакет приложения (com.stefu.music или com.stefu.music.shots) — из пути к папке данных;
// это же и схема ссылок (plugins/withLinks.js). Работает и без открытого приложения.
const PKG = ((FileSystem.documentDirectory || '').match(/\/(com\.stefu\.music[\w.]*)\/files/) || [])[1] || 'com.stefu.music';
export const SCHEME = PKG;

/** Понедельник 00:00 текущей недели (как «Неделя» в Топ-20). */
export function weekStart(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime() - ((d.getDay() + 6) % 7) * 86400000;
}

/** Снимок для «Топа недели», «Плейлистов» и «Статистики». lib — значение LibraryContext. */
export function buildWidgetData(lib) {
  const ws = weekStart();
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const today = d0.getTime();
  let todaySec = 0, weekSec = 0;
  const cnt = {}, art = {};
  for (const p of lib.plays || []) {
    if (p.t < ws) continue;
    const sec = p.d || 0;
    weekSec += sec;
    if (p.t >= today) todaySec += sec;
    if (p.c) cnt[p.s] = (cnt[p.s] || 0) + 1;
    const s = lib.byId[p.s];
    if (s) for (const a of artistsOf(s)) art[a] = (art[a] || 0) + sec;
  }
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, n]) => { const s = lib.byId[id]; return s ? { id, title: s.title, artist: s.artist || '', n } : null; })
    .filter(Boolean);
  const artist = Object.entries(art).sort((a, b) => b[1] - a[1])[0];
  const playlists = (lib.playlists || []).slice(0, 6).map(pl => ({ name: pl.name, n: pl.ids.filter(id => lib.byId[id]).length }));
  return {
    top, playlists,
    stats: { todayMin: Math.round(todaySec / 60), weekMin: Math.round(weekSec / 60), artist: artist ? artist[0] : '' },
  };
}

async function readJson(key) {
  try { return JSON.parse(await AsyncStorage.getItem(key)) || {}; } catch (e) { return {}; }
}

/** Всё, что нужно виджетам: живое состояние или последний снимок. */
export async function widgetContext() {
  const g = global.__stefuWidget;
  const live = !!g;
  const now = live ? g.state() : await readJson(K_WIDGET);
  const data = global.__stefuWidgetData || await readJson(K_WDATA);
  let lang = global.__stefuLang;
  if (!lang) { try { lang = (await AsyncStorage.getItem('sm_lang_widget')) || (await AsyncStorage.getItem('sm_lang')) || deviceLang(); } catch (e) { lang = 'en'; } }
  return { live, now: { ...now, playing: !!(live && now.playing) }, data, lang };
}

// Обложка для ImageWidget — data:-ссылка. Последняя прочитанная держится в памяти:
// при паузе и смене кнопок файл заново не читается. Огромные картинки пропускаем
// (у виджета ограничен объём картинок).
const coverCache = { key: null, uri: null };
export async function coverData(file) {
  if (!file) return null;
  if (coverCache.key === file) return coverCache.uri;
  try {
    const path = FileSystem.documentDirectory + 'covers/' + file;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || info.size > 1500000) return null;
    const b64 = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 });
    const uri = `data:image/${/\.png$/i.test(file) ? 'png' : 'jpeg'};base64,${b64}`;
    coverCache.key = file; coverCache.uri = uri;
    return uri;
  } catch (e) { return null; }
}
