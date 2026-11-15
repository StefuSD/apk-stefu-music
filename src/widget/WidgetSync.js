import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { useLibrary } from '../context/LibraryContext';
import { usePlayer, usePlayerStatus } from '../context/PlayerContext';
import { useLang } from '../i18n';
import { buildWidgetData, K_WDATA } from './data';
import { renderWidget } from './widgets';

// Обновить виджет, если он стоит на рабочем столе (иначе — тихо ничего).
const update = name => requestWidgetUpdate({ widgetName: name, renderWidget: info => renderWidget(name, info), widgetNotFound: () => {} }).catch(() => {});
const updateAll = names => { if (Platform.OS === 'android') names.forEach(update); };

const PLAYER = ['PlayerLarge', 'Cover'];
const LISTS = ['Playlists', 'TopWeek', 'Stats'];
const STATIC = ['Actions', 'ShortSnippets', 'ShortMix', 'ShortSleep'];

/**
 * Держит виджеты на рабочем столе в актуальном виде, пока приложение работает:
 *  • плеер и обложка — при смене песни, паузе, сердечке, новой обложке;
 *  • большой плеер — ещё раз в 30 с, пока играет (полоска прогресса);
 *  • плейлисты, топ недели, статистика — через 3 с после изменений истории и плейлистов
 *    (снимок заодно сохраняется: по нему виджеты рисуются без приложения);
 *  • подписи всех виджетов — при смене языка.
 */
export default function WidgetSync() {
  const lib = useLibrary();
  const player = usePlayer();
  const { playing } = usePlayerStatus();
  const { lang } = useLang();
  const song = lib.byId[player.currentId];

  useEffect(() => {
    global.__stefuLang = lang;
    AsyncStorage.setItem('sm_lang_widget', lang).catch(() => {});
    updateAll(STATIC);
  }, [lang]);

  useEffect(() => { updateAll(PLAYER); }, [player.currentId, playing, song && song.fav, song && song.cover, lang]);

  useEffect(() => {
    if (!playing) return undefined;
    const h = setInterval(() => updateAll(['PlayerLarge']), 30000);
    return () => clearInterval(h);
  }, [playing]);

  useEffect(() => {
    if (!lib.loaded) return undefined;
    const h = setTimeout(() => {
      const d = buildWidgetData(lib);
      global.__stefuWidgetData = d;
      AsyncStorage.setItem(K_WDATA, JSON.stringify(d)).catch(() => {});
      updateAll(LISTS);
    }, 3000);
    return () => clearTimeout(h);
  }, [lib.loaded, lib.plays, lib.playlists, lib.songs, lang]);

  return null;
}
