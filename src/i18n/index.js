import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uk from './locales/uk';
import ro from './locales/ro';
import es from './locales/es';
import it from './locales/it';
import de from './locales/de';
import pt from './locales/pt';
import pl from './locales/pl';
import tr from './locales/tr';
import fr from './locales/fr';


const ru = {
  nav_music: 'Музыка', nav_reports: 'Отчёты', nav_settings: 'Настройки',
  app_title: 'Stefu Music',
  search: 'Поиск: название, исполнитель, тег',
  add_music: 'Добавить музыку',
  add_files: 'Выбрать файлы', add_folder: 'Добавить папку целиком', add_how: 'Как добавить музыку?',
  folder_empty: 'В папке нет аудиофайлов (MP3, M4A, FLAC, OGG, WAV). Подпапки не просматриваются.',
  similar: 'Похожие', radio: 'Радио по песне', radio_started: 'Радио: {t}', for_you: 'Микс для вас',
  similar_none: 'Похожих пока нет — добавьте песням теги, жанр или послушайте больше.',
  importing: 'Добавляю: {n} из {m}…',
  imported: 'Добавлено песен: {n}',
  skipped_dup: 'Уже были в библиотеке: {n}',
  empty_title: 'Здесь будет ваша музыка',
  empty_text: 'Нажмите «Добавить музыку» и выберите файлы или целую папку с телефона (MP3, M4A, FLAC и другие). Название, исполнитель и обложка берутся из тегов файла.',
  nothing_found: 'Ничего не найдено',
  all: 'Все', favorites: 'Избранное',
  sort_recent: 'Новые', sort_title: 'А–Я', sort_artist: 'Исполнитель', sort_plays: 'Частые', sort_last: 'Недавние',
  songs_count: '{n} песен',
  unknown_artist: 'Неизвестный исполнитель',
  play_all: 'Играть все', shuffle: 'Вперемешку',
  edit_song: 'Песня',
  f_title: 'Название', f_artist: 'Исполнитель', f_artists: 'Исполнители', artist_add: 'Добавить исполнителя', f_album: 'Альбом', f_genre: 'Жанр', f_year: 'Год',
  f_tags: 'Теги', f_note: 'Заметка', f_lyrics: 'Слова песни', f_cover: 'Обложка',
  lyrics_hint: 'Вставьте или напишите слова песни', lyrics_paste: 'Вставить', lyrics_clear: 'Очистить', clipboard_empty: 'Буфер обмена пуст',
  f_trim: 'Обрезка и затухание', trim_start: 'Начало', trim_end: 'Конец', fade_in: 'Плавное начало', fade_out: 'Плавный конец',
  trim_now: 'Сейчас', trim_reset: 'Сбросить', fade_off: 'Нет', sec_short: 'с',
  trim_hint: 'Играет только кусок от начала до конца, громкость плавно растёт и стихает. Сам файл не меняется.',
  total_len: '{n} песен · {d}', scanning: 'Считаю длительность: {n} из {m}…',
  f_langs: 'Языки песни', lang_other: 'Другой язык', f_video: 'Ссылка на видео', video_hint: 'youtube.com/watch?v=…',
  video: 'Видео', video_open: 'Открыть', video_bad: 'Не удалось открыть ссылку: {u}', r_top_langs: 'Языки',
  cover_pick: 'Выбрать обложку из галереи', cover_change: 'Сменить обложку', cover_remove: 'Убрать обложку',
  cover_url: 'Обложка по ссылке', cover_url_hint: 'Вставьте ссылку на картинку (или на видео YouTube — возьмём его кадр).', cover_download: 'Скачать', cover_url_bad: 'По этой ссылке не удалось скачать картинку.',
  lyrics: 'Слова', lyrics_none: 'Слов у этой песни пока нет. Их можно вставить в карточке песни.', lyrics_add: 'Добавить слова',
  tag_add: 'Новый тег', tag_hint: 'Например: спорт, вечер, дорога',
  tags_existing: 'Ваши теги',
  save: 'Сохранить', cancel: 'Отмена', delete: 'Удалить', close: 'Закрыть',
  delete_q: 'Удалить песню «{t}» с телефона? История прослушиваний останется в отчётах.',
  delete_many_q: 'Удалить выбранные песни ({n})?',
  plays_n: 'прослушиваний: {n}',
  song_info: 'Добавлена {d} · {size}',
  f_theme: 'Тема фона', theme_auto: 'Авто', theme_pick: 'Выбрать тему', theme_shuffle: 'Другой узор',
  share: 'Поделиться', queue_next: 'Играть следующей',
  queued: 'Будет следующей',
  now_playing: 'Сейчас играет',
  repeat_off: 'Повтор выключен', repeat_all: 'Повтор списка', repeat_one: 'Повтор песни',
  // reports
  r_week: '7 дней', r_month: '30 дней', r_year: 'Год', r_all: 'Всё время',
  r_time: 'Слушали', r_plays: 'Прослушиваний', r_songs: 'Разных песен', r_streak: 'Дней подряд',
  r_by_day: 'По дням', r_by_month: 'По месяцам', r_by_hour: 'Когда слушаете',
  r_top_songs: 'Топ песен', r_top_artists: 'Топ исполнителей', r_top_tags: 'Топ тегов', r_top_genres: 'Топ жанров',
  r_empty: 'Отчёты появятся, когда вы послушаете музыку. Прослушивание засчитывается после 30 секунд (или половины короткой песни).',
  r_minutes: '{n} мин', r_hours: '{h} ч {m} мин',
  r_never: 'Ни разу не слушали', r_never_hint: 'Песни из библиотеки, которых нет в истории',
  r_avg_day: 'В среднем {v} в день',
  // settings
  s_look: 'Оформление', s_theme_dark: 'Тёмная тема', s_lang: 'Язык',
  s_library: 'Библиотека', s_stats: 'Песен: {n} · {size}',
  s_data: 'Данные', s_export: 'Выгрузить историю и библиотеку (JSON)',
  s_clear_history: 'Очистить историю прослушиваний',
  s_clear_history_q: 'Удалить всю историю прослушиваний? Отчёты начнутся с нуля. Песни останутся.',
  s_clear_all: 'Удалить всю музыку и историю',
  s_clear_all_q: 'Удалить все песни с телефона и всю историю? Это нельзя отменить.',
  s_about: 'О приложении',
  s_about_text: 'Музыка хранится только на этом телефоне, в папке приложения. Ничего не отправляется в интернет.',
  s_support: 'Поддержка: stefu.apps@gmail.com',
  s_version: 'Версия {v}',
  done: 'Готово',
  min_short: 'мин',
};

const en = {
  nav_music: 'Music', nav_reports: 'Reports', nav_settings: 'Settings',
  app_title: 'Stefu Music',
  search: 'Search: title, artist, tag',
  add_music: 'Add music',
  add_files: 'Pick files', add_folder: 'Add a whole folder', add_how: 'How to add music?',
  folder_empty: 'No audio files (MP3, M4A, FLAC, OGG, WAV) in this folder. Subfolders are not scanned.',
  similar: 'Similar', radio: 'Song radio', radio_started: 'Radio: {t}', for_you: 'Mix for you',
  similar_none: 'No similar songs yet — add tags or genre, or listen more.',
  importing: 'Adding {n} of {m}…',
  imported: 'Songs added: {n}',
  skipped_dup: 'Already in library: {n}',
  empty_title: 'Your music will live here',
  empty_text: 'Tap “Add music” and pick files or a whole folder on your phone (MP3, M4A, FLAC and more). Title, artist and cover are read from the file tags.',
  nothing_found: 'Nothing found',
  all: 'All', favorites: 'Favorites',
  sort_recent: 'New', sort_title: 'A–Z', sort_artist: 'Artist', sort_plays: 'Most played', sort_last: 'Recent',
  songs_count: '{n} songs',
  unknown_artist: 'Unknown artist',
  play_all: 'Play all', shuffle: 'Shuffle',
  edit_song: 'Song',
  f_title: 'Title', f_artist: 'Artist', f_artists: 'Artists', artist_add: 'Add artist', f_album: 'Album', f_genre: 'Genre', f_year: 'Year',
  f_tags: 'Tags', f_note: 'Note', f_lyrics: 'Lyrics', f_cover: 'Cover',
  lyrics_hint: 'Paste or type the lyrics', lyrics_paste: 'Paste', lyrics_clear: 'Clear', clipboard_empty: 'Clipboard is empty',
  f_trim: 'Trim and fade', trim_start: 'Start', trim_end: 'End', fade_in: 'Fade in', fade_out: 'Fade out',
  trim_now: 'Now', trim_reset: 'Reset', fade_off: 'Off', sec_short: 's',
  trim_hint: 'Only the part from start to end plays, the volume fades in and out. The file itself is not changed.',
  total_len: '{n} songs · {d}', scanning: 'Measuring duration: {n} of {m}…',
  f_langs: 'Song languages', lang_other: 'Other language', f_video: 'Video link', video_hint: 'youtube.com/watch?v=…',
  video: 'Video', video_open: 'Open', video_bad: 'Could not open the link: {u}', r_top_langs: 'Languages',
  cover_pick: 'Pick a cover from gallery', cover_change: 'Change cover', cover_remove: 'Remove cover',
  cover_url: 'Cover from link', cover_url_hint: 'Paste a link to an image (or a YouTube video — we’ll use its thumbnail).', cover_download: 'Download', cover_url_bad: 'Could not download an image from this link.',
  lyrics: 'Lyrics', lyrics_none: 'No lyrics for this song yet. You can paste them in the song card.', lyrics_add: 'Add lyrics',
  tag_add: 'New tag', tag_hint: 'E.g. workout, evening, road',
  tags_existing: 'Your tags',
  save: 'Save', cancel: 'Cancel', delete: 'Delete', close: 'Close',
  delete_q: 'Delete “{t}” from the phone? Listening history stays in reports.',
  delete_many_q: 'Delete selected songs ({n})?',
  plays_n: 'plays: {n}',
  song_info: 'Added {d} · {size}',
  f_theme: 'Background theme', theme_auto: 'Auto', theme_pick: 'Choose theme', theme_shuffle: 'Another pattern',
  share: 'Share', queue_next: 'Play next',
  queued: 'Up next',
  now_playing: 'Now playing',
  repeat_off: 'Repeat off', repeat_all: 'Repeat list', repeat_one: 'Repeat song',
  r_week: '7 days', r_month: '30 days', r_year: 'Year', r_all: 'All time',
  r_time: 'Listened', r_plays: 'Plays', r_songs: 'Unique songs', r_streak: 'Day streak',
  r_by_day: 'By day', r_by_month: 'By month', r_by_hour: 'When you listen',
  r_top_songs: 'Top songs', r_top_artists: 'Top artists', r_top_tags: 'Top tags', r_top_genres: 'Top genres',
  r_empty: 'Reports appear once you listen to music. A play counts after 30 seconds (or half of a short song).',
  r_minutes: '{n} min', r_hours: '{h} h {m} min',
  r_never: 'Never played', r_never_hint: 'Library songs that are not in the history',
  r_avg_day: 'On average {v} a day',
  s_look: 'Appearance', s_theme_dark: 'Dark theme', s_lang: 'Language',
  s_library: 'Library', s_stats: 'Songs: {n} · {size}',
  s_data: 'Data', s_export: 'Export history and library (JSON)',
  s_clear_history: 'Clear listening history',
  s_clear_history_q: 'Delete the whole listening history? Reports start from zero. Songs stay.',
  s_clear_all: 'Delete all music and history',
  s_clear_all_q: 'Delete all songs from the phone and the whole history? This cannot be undone.',
  s_about: 'About',
  s_about_text: 'Music is stored only on this phone, in the app folder. Nothing is sent to the internet.',
  s_support: 'Support: stefu.apps@gmail.com',
  s_version: 'Version {v}',
  done: 'Done',
  min_short: 'min',
};

// 11 языков интерфейса. Русский и английский — здесь, остальные — в locales/.
export const LANGS = { en, ru, uk, ro, es, it, de, pt, pl, tr, fr };
export const LANG_NAMES = {
  en: 'English', ru: 'Русский', uk: 'Українська', ro: 'Română', es: 'Español', it: 'Italiano', de: 'Deutsch',
  pt: 'Português', pl: 'Polski', tr: 'Türkçe', fr: 'Français',
};

function deviceLang() {
  try {
    const loc = (Intl.DateTimeFormat().resolvedOptions().locale || 'en').toLowerCase();
    const code = loc.slice(0, 2);
    if (LANGS[code]) return code;
    if (/^(be|kk|ky|uz|tg|hy|az|ka)/.test(code)) return 'ru';
    if (code === 'mo') return 'ro';
    return 'en';
  } catch (e) { return 'en'; }
}

const LangContext = createContext({ lang: 'ru', t: k => k, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(deviceLang());
  useEffect(() => { AsyncStorage.getItem('sm_lang').then(l => { if (l && LANGS[l]) setLangState(l); }); }, []);
  const value = useMemo(() => {
    const dict = LANGS[lang] || en;
    const t = (k, p) => {
      let s = dict[k] ?? en[k] ?? k;
      if (p) for (const n of Object.keys(p)) s = s.split('{' + n + '}').join(String(p[n]));
      return s;
    };
    return { lang, t, setLang: l => { setLangState(l); AsyncStorage.setItem('sm_lang', l); } };
  }, [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
