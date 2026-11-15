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
import nl from './locales/nl';
import cs from './locales/cs';
import hu from './locales/hu';
import sv from './locales/sv';
import el from './locales/el';
import bg from './locales/bg';
import hr from './locales/hr';
import lt from './locales/lt';


const ru = {
  nav_music: 'Музыка', nav_top: 'Топ-20', nav_reports: 'Отчёты', nav_settings: 'Настройки',
  app_title: 'Stefu Music',
  search: 'Поиск: название, исполнитель, тег',
  add_music: 'Добавить музыку', add_short: 'Добавить',
  add_files: 'Выбрать файлы', add_folder: 'Добавить папку целиком', add_how: 'Как добавить музыку?',
  folder_empty: 'В папке нет аудиофайлов (MP3, M4A, FLAC, OGG, WAV). Подпапки не просматриваются.',
  similar: 'Похожие', radio: 'Радио по песне', radio_started: 'Радио: {t}', for_you: 'Микс',
  similar_none: 'Похожих пока нет — добавьте песням теги, жанр или послушайте больше.',
  importing: 'Добавляю: {n} из {m}…',
  imported: 'Добавлено песен: {n}',
  skipped_dup: 'Уже были в библиотеке: {n}', dup_updated: 'Из них дополнено (обложка, теги, слова): {n}',
  empty_title: 'Здесь будет ваша музыка',
  empty_text: 'Нажмите «Добавить музыку» и выберите файлы или целую папку с телефона (MP3, M4A, FLAC и другие). Название, исполнитель и обложка берутся из тегов файла.',
  nothing_found: 'Ничего не найдено',
  all: 'Все', favorites: 'Избранное', flt_lyrics: 'Со словами', flt_video: 'С клипом',
  sort_recent: 'Новые', sort_title: 'А–Я', sort_artist: 'Исполнитель', sort_plays: 'Частые', sort_last: 'Недавние',
  songs_count: '{n} {songs}', songs_forms: 'песня|песни|песен',
  unknown_artist: 'Неизвестный исполнитель',
  play_all: 'Играть все', shuffle: 'Вперемешку',
  edit_song: 'Песня',
  f_title: 'Название', f_artist: 'Исполнитель', f_artists: 'Исполнители', artist_add: 'Добавить исполнителя', f_album: 'Альбом', f_genre: 'Жанр', f_year: 'Год',
  f_tags: 'Теги', f_note: 'Заметка', f_lyrics: 'Слова песни', f_cover: 'Обложка',
  lyrics_hint: 'Вставьте или напишите слова песни', lyrics_paste: 'Вставить', lyrics_clear: 'Очистить', clipboard_empty: 'Буфер обмена пуст',
  f_trim: 'Обрезка и затухание', trim_start: 'Начало', trim_end: 'Конец', fade_in: 'Плавное начало', fade_out: 'Плавный конец',
  trim_now: 'Сейчас', trim_reset: 'Сбросить', fade_off: 'Нет', sec_short: 'с',
  trim_hint: 'Играет только кусок от начала до конца, громкость плавно растёт и стихает. Сам файл не меняется.',
  total_len: '{n} {songs} · {d}', scanning: 'Считаю длительность: {n} из {m}…',
  f_langs: 'Языки песни', lang_other: 'Другой язык', f_video: 'Ссылка на видео', video_hint: 'youtube.com/watch?v=…',
  video: 'Видео', video_open: 'Открыть', video_bad: 'Не удалось открыть ссылку: {u}', r_top_langs: 'Языки',
  cover_pick: 'Выбрать обложку из галереи', cover_change: 'Сменить обложку', cover_remove: 'Убрать обложку',
  cover_url: 'Обложка по ссылке', cover_url_hint: 'Вставьте ссылку на картинку (или на видео YouTube — возьмём его кадр).', cover_download: 'Скачать', cover_url_bad: 'По этой ссылке не удалось скачать картинку.',
  lyrics: 'Слова', lyrics_edit: 'Изменить', lyrics_save: 'Сохранить', lyrics_saved: 'Слова сохранены', lyrics_google: 'Найти в Google', lyrics_query: 'текст песни', lyrics_none: 'Слов у этой песни пока нет. Вставьте их прямо сюда — например, скопировав из браузера.', lyrics_add: 'Добавить слова',
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
  tp_week: 'Неделя', tp_month: 'Месяц', tp_year: 'Год',
  r_week: '7 дней', r_month: '30 дней', r_year: 'Год', r_all: 'Всё время',
  r_time: 'Слушали', r_plays: 'Прослушиваний', r_songs: 'Разных песен', r_streak: 'Дней подряд',
  r_by_day: 'По дням', r_by_month: 'По месяцам', r_by_hour: 'Когда слушаете',
  r_top_songs: 'Топ песен', r_top_artists: 'Топ исполнителей', r_top_tags: 'Топ тегов', r_top_genres: 'Топ жанров',
  r_empty: 'Отчёты появятся, когда вы послушаете музыку. Прослушивание засчитывается после 30 секунд (или половины короткой песни).',
  r_minutes: '{n} мин', r_hours: '{h} ч {m} мин',
  r_never: 'Ни разу не слушали', r_never_hint: 'Песни из библиотеки, которых нет в истории',
  r_avg_day: 'В среднем {v} в день',
  // settings
  s_theme: 'Тема', s_theme_light: 'Светлая', s_theme_night: 'Тёмная', s_theme_lilac: 'Сирень', s_look: 'Оформление', s_theme_dark: 'Тёмная тема', s_lang: 'Язык',
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
  // обложки из интернета
  cover_web: 'Обложка в браузере',
  cover_find: 'Найти обложку в интернете', cover_find_hint: 'Поиск по исполнителю и названию (iTunes, Deezer). Нажмите на подходящую обложку.',
  cover_find_none: 'Ничего не нашлось — попробуйте изменить запрос.', cover_find_net: 'Нет связи с интернетом или сервис не ответил.',
  covers_find_all: 'Найти обложки для песен без обложки', covers_progress: 'Ищу обложки: {n} из {m} · найдено {found}',
  covers_hint: 'Нужен интернет. Берётся только обложка, у которой совпали исполнитель и название. Файлы песен не меняются.',
  covers_done: 'Найдено обложек: {n} из {m}.', stop: 'Стоп',
  // таймер сна
  sleep: 'Таймер сна', sleep_hint: 'Музыка плавно затихнет и остановится', sleep_min: 'Через {n} мин',
  sleep_end: 'После этой песни', sleep_end_short: 'После песни', sleep_left: 'Сон · {n} мин', sleep_off: 'Выключить таймер',
  // плейлисты и выбор
  pl_new: 'Новый плейлист', pl_short: 'Плейлист', pl_name: 'Название плейлиста', pl_add: 'Добавить в плейлист',
  pl_added: 'Добавлено в «{p}»: {n}', pl_created: 'Плейлист «{p}» создан. Добавляйте песни через меню «⋮» или долгим нажатием.',
  pl_already: 'Уже есть в «{p}»', pl_remove: 'Убрать из плейлиста', pl_manage: 'Плейлист',
  pl_order: 'Изменить порядок', pl_order_hint: 'Тяните за «=» справа, крестик убирает песню', pl_empty: 'В плейлисте пока нет песен',
  pl_rename: 'Переименовать', pl_delete: 'Удалить плейлист', pl_delete_q: 'Удалить плейлист «{p}»? Песни останутся в библиотеке.',
  sel_n: 'Выбрано: {n}', sel_all: 'Все', sel_none: 'Снять',
  bulk_edit: 'Изменить', bulk_title: 'Изменить песни: {n}', bulk_hint: 'Отмеченное применится ко всем выбранным песням. Пустые поля ничего не меняют.',
  bulk_add_tags: 'Добавить теги', bulk_del_tags: 'Убрать теги', bulk_add_langs: 'Добавить языки', bulk_del_langs: 'Убрать языки',
  bulk_keep: 'Не менять', bulk_fav_on: 'В избранное', bulk_fav_off: 'Убрать из избранного',
  bulk_apply: 'Применить к {n}', bulk_done: 'Изменено песен: {n}',
  // топ-20 и итоги
  top_songs: 'Песни', top_artists: 'Исполнители', top_albums: 'Альбомы', top_new: 'новая',
  top_added: 'Новинки', top_no_added: 'За этот период новых песен не добавлено.', top_added_hint: 'Песни, добавленные за этот период; сверху — самые слушаемые.', top_added_hint_all: 'Последние добавленные песни.',
  top_no_albums: 'У прослушанных песен не указан альбом.', top_delta_hint: 'Стрелки — место по сравнению с прошлой неделей, месяцем или годом.',
  recap_title: 'Итоги {y} года', recap_sub: 'Ваш год в музыке — карточкой, которой можно поделиться',
  recap_empty: 'В этом году вы ещё ничего не слушали.', recap_h: 'ч', recap_streak: 'Дней подряд (рекорд)',
  recap_song: 'Песня года', recap_month: 'Самый музыкальный месяц', recap_hour: 'Любимое время', recap_tag: 'Главный тег',
  recap_share: 'Поделиться картинкой',
  show_all: 'Показать все ({n})', show_less: 'Свернуть',
  // настройки
  s_play: 'Воспроизведение', xfade: 'Плавный переход между песнями',
  xfade_hint: 'Конец песни затихает, а следующая в это время набирает громкость.',
  s_similar: 'Похожие и микс', tw_title: 'Веса тегов',
  tw_hint: '×1 — обычный тег. ×2 и ×3 — тег важнее, «Похожие» и «Микс» опираются на него сильнее. ×0 — тег не учитывается (например, «новое»).',
  tw_none: 'Тегов пока нет — добавьте их песням.',
  sound_load: 'Загрузить данные о звучании', sound_done: 'Звучание добавлено песням: {n} (в файле {m}).',
  sound_bad: 'Не удалось прочитать файл.',
  sound_hint: 'Темп, энергию и яркость звука считает программа на компьютере (tools/sound.py) и сохраняет в stefu-music-sound.json. С ними «Похожие» учитывают и звучание. Новые песни с этими данными в файле получают их сами.',
  // сниппеты (самая яркая часть песни, обычно припев)
  f_chorus: 'Сниппет', chorus_start: 'Начало сниппета', chorus_end: 'Конец сниппета',
  chorus_auto: 'найден по звуку', chorus_manual: 'задан вручную', chorus_none: 'ещё не найден — берётся середина песни',
  chorus_listen: 'Послушать', chorus_reset: 'Найти заново',
  chorus_hint: 'Сниппет находится сам по звуку: самый повторяющийся и яркий кусок песни, обычно припев. Если ошибся — поправьте, ручной сниппет не перезаписывается.',
  chorus_jump: 'К сниппету',
  snip_mode: 'Только сниппеты', snip_short: 'Сниппеты', snip_started: 'Только сниппеты: от каждой песни — самая яркая часть',
  snip_mode_hint: 'Понравилась — сердечко или «Целиком». Нет — «Дальше».',
  snip_like: 'Нравится', snip_liked: 'В избранном', snip_full: 'Целиком', snip_next: 'Дальше',
  snip_never: 'Прослушать сниппеты', snip_left: 'Бесплатно сегодня: осталось {n} из {m}',
  an_title: 'Разбор звука', an_progress: 'Разбираю песни: {n} из {m}…', an_redo: 'Разобрать все песни заново',
  an_redo_q: 'Найти сниппеты, темп и энергию для всех песен заново? Ручные сниппеты останутся.',
  an_hint: 'Прямо на телефоне, без интернета: сниппет (самая яркая часть песни), темп, энергия и яркость звука. Новые песни разбираются сами после добавления.',
};

const en = {
  nav_music: 'Music', nav_top: 'Top 20', nav_reports: 'Reports', nav_settings: 'Settings',
  app_title: 'Stefu Music',
  search: 'Search: title, artist, tag',
  add_music: 'Add music', add_short: 'Add',
  add_files: 'Pick files', add_folder: 'Add a whole folder', add_how: 'How to add music?',
  folder_empty: 'No audio files (MP3, M4A, FLAC, OGG, WAV) in this folder. Subfolders are not scanned.',
  similar: 'Similar', radio: 'Song radio', radio_started: 'Radio: {t}', for_you: 'Mix',
  similar_none: 'No similar songs yet — add tags or genre, or listen more.',
  importing: 'Adding {n} of {m}…',
  imported: 'Songs added: {n}',
  skipped_dup: 'Already in library: {n}', dup_updated: 'Of these, filled in (cover, tags, lyrics): {n}',
  empty_title: 'Your music will live here',
  empty_text: 'Tap “Add music” and pick files or a whole folder on your phone (MP3, M4A, FLAC and more). Title, artist and cover are read from the file tags.',
  nothing_found: 'Nothing found',
  all: 'All', favorites: 'Favorites', flt_lyrics: 'With lyrics', flt_video: 'With video',
  sort_recent: 'New', sort_title: 'A–Z', sort_artist: 'Artist', sort_plays: 'Most played', sort_last: 'Recent',
  songs_count: '{n} {songs}', songs_forms: 'song|songs',
  unknown_artist: 'Unknown artist',
  play_all: 'Play all', shuffle: 'Shuffle',
  edit_song: 'Song',
  f_title: 'Title', f_artist: 'Artist', f_artists: 'Artists', artist_add: 'Add artist', f_album: 'Album', f_genre: 'Genre', f_year: 'Year',
  f_tags: 'Tags', f_note: 'Note', f_lyrics: 'Lyrics', f_cover: 'Cover',
  lyrics_hint: 'Paste or type the lyrics', lyrics_paste: 'Paste', lyrics_clear: 'Clear', clipboard_empty: 'Clipboard is empty',
  f_trim: 'Trim and fade', trim_start: 'Start', trim_end: 'End', fade_in: 'Fade in', fade_out: 'Fade out',
  trim_now: 'Now', trim_reset: 'Reset', fade_off: 'Off', sec_short: 's',
  trim_hint: 'Only the part from start to end plays, the volume fades in and out. The file itself is not changed.',
  total_len: '{n} {songs} · {d}', scanning: 'Measuring duration: {n} of {m}…',
  f_langs: 'Song languages', lang_other: 'Other language', f_video: 'Video link', video_hint: 'youtube.com/watch?v=…',
  video: 'Video', video_open: 'Open', video_bad: 'Could not open the link: {u}', r_top_langs: 'Languages',
  cover_pick: 'Pick a cover from gallery', cover_change: 'Change cover', cover_remove: 'Remove cover',
  cover_url: 'Cover from link', cover_url_hint: 'Paste a link to an image (or a YouTube video — we’ll use its thumbnail).', cover_download: 'Download', cover_url_bad: 'Could not download an image from this link.',
  lyrics: 'Lyrics', lyrics_edit: 'Edit', lyrics_save: 'Save', lyrics_saved: 'Lyrics saved', lyrics_google: 'Search Google', lyrics_query: 'lyrics', lyrics_none: 'This song has no lyrics yet. Paste them right here — for example, copied from a browser.', lyrics_add: 'Add lyrics',
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
  tp_week: 'Week', tp_month: 'Month', tp_year: 'Year',
  r_week: '7 days', r_month: '30 days', r_year: 'Year', r_all: 'All time',
  r_time: 'Listened', r_plays: 'Plays', r_songs: 'Unique songs', r_streak: 'Day streak',
  r_by_day: 'By day', r_by_month: 'By month', r_by_hour: 'When you listen',
  r_top_songs: 'Top songs', r_top_artists: 'Top artists', r_top_tags: 'Top tags', r_top_genres: 'Top genres',
  r_empty: 'Reports appear once you listen to music. A play counts after 30 seconds (or half of a short song).',
  r_minutes: '{n} min', r_hours: '{h} h {m} min',
  r_never: 'Never played', r_never_hint: 'Library songs that are not in the history',
  r_avg_day: 'On average {v} a day',
  s_theme: 'Theme', s_theme_light: 'Light', s_theme_night: 'Dark', s_theme_lilac: 'Lilac', s_look: 'Appearance', s_theme_dark: 'Dark theme', s_lang: 'Language',
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
  cover_web: 'Cover in browser',
  cover_find: 'Find cover online', cover_find_hint: 'Search by artist and title (iTunes, Deezer). Tap the right cover.',
  cover_find_none: 'Nothing found — try changing the search.', cover_find_net: 'No internet connection or the service did not respond.',
  covers_find_all: 'Find covers for songs without one', covers_progress: 'Finding covers: {n} of {m} · found {found}',
  covers_hint: 'Needs internet. Only a cover whose artist and title both match is used. Song files are not changed.',
  covers_done: 'Covers found: {n} of {m}.', stop: 'Stop',
  sleep: 'Sleep timer', sleep_hint: 'Music fades out and stops', sleep_min: 'In {n} min',
  sleep_end: 'After this song', sleep_end_short: 'After song', sleep_left: 'Sleep · {n} min', sleep_off: 'Turn off timer',
  pl_new: 'New playlist', pl_short: 'Playlist', pl_name: 'Playlist name', pl_add: 'Add to playlist',
  pl_added: 'Added to “{p}”: {n}', pl_created: 'Playlist “{p}” created. Add songs from the “⋮” menu or with a long press.',
  pl_already: 'Already in “{p}”', pl_remove: 'Remove from playlist', pl_manage: 'Playlist',
  pl_order: 'Reorder', pl_order_hint: 'Drag the “=” handle; the cross removes a song', pl_empty: 'No songs in this playlist yet',
  pl_rename: 'Rename', pl_delete: 'Delete playlist', pl_delete_q: 'Delete playlist “{p}”? The songs stay in your library.',
  sel_n: 'Selected: {n}', sel_all: 'All', sel_none: 'None',
  bulk_edit: 'Edit', bulk_title: 'Edit songs: {n}', bulk_hint: 'What you mark applies to all selected songs. Empty fields change nothing.',
  bulk_add_tags: 'Add tags', bulk_del_tags: 'Remove tags', bulk_add_langs: 'Add languages', bulk_del_langs: 'Remove languages',
  bulk_keep: 'Keep as is', bulk_fav_on: 'Add to favorites', bulk_fav_off: 'Remove from favorites',
  bulk_apply: 'Apply to {n}', bulk_done: 'Songs changed: {n}',
  top_songs: 'Songs', top_artists: 'Artists', top_albums: 'Albums', top_new: 'new',
  top_added: 'New', top_no_added: 'No songs were added in this period.', top_added_hint: 'Songs added in this period, most played first.', top_added_hint_all: 'Most recently added songs.',
  top_no_albums: 'The songs you played have no album set.', top_delta_hint: 'Arrows show the change from the previous week, month or year.',
  recap_title: 'Your {y} in music', recap_sub: 'Your year in music as a card you can share',
  recap_empty: 'You have not listened to anything this year yet.', recap_h: 'h', recap_streak: 'Days in a row (record)',
  recap_song: 'Song of the year', recap_month: 'Most musical month', recap_hour: 'Favorite time', recap_tag: 'Top tag',
  recap_share: 'Share as image',
  show_all: 'Show all ({n})', show_less: 'Show less',
  s_play: 'Playback', xfade: 'Crossfade between songs',
  xfade_hint: 'The end of a song fades out while the next one fades in.',
  s_similar: 'Similar and mix', tw_title: 'Tag weights',
  tw_hint: '×1 is a normal tag. ×2 and ×3 make a tag more important for “Similar” and “Mix”. ×0 ignores the tag (for example, “new”).',
  tw_none: 'No tags yet — add some to your songs.',
  sound_load: 'Load sound data', sound_done: 'Sound data added to songs: {n} (file has {m}).',
  sound_bad: 'Could not read the file.',
  sound_hint: 'Tempo, energy and brightness are computed on a computer (tools/sound.py) and saved to stefu-music-sound.json. With them, “Similar” also considers how songs sound. New songs that carry this data in the file get it automatically.',
  f_chorus: 'Snippet', chorus_start: 'Snippet start', chorus_end: 'Snippet end',
  chorus_auto: 'found from the sound', chorus_manual: 'set by hand', chorus_none: 'not found yet — the middle of the song is used',
  chorus_listen: 'Listen', chorus_reset: 'Find again',
  chorus_hint: 'The snippet is found automatically from the sound: the most repeated, catchiest part of the song, usually the chorus. If it is wrong, fix it — a snippet set by hand is never overwritten.',
  chorus_jump: 'To snippet',
  snip_mode: 'Snippets only', snip_short: 'Snippets', snip_started: 'Snippets only: the catchiest part of each song',
  snip_mode_hint: 'Like it — tap the heart or “Full song”. Not for you — “Next”.',
  snip_like: 'Like', snip_liked: 'Added to favorites', snip_full: 'Full song', snip_next: 'Next',
  snip_never: 'Preview snippets', snip_left: 'Free today: {n} of {m} left',
  an_title: 'Sound analysis', an_progress: 'Analyzing songs: {n} of {m}…', an_redo: 'Analyze all songs again',
  an_redo_q: 'Find snippets, tempo and energy for all songs again? Snippets set by hand stay.',
  an_hint: 'Right on the phone, offline: the snippet (the catchiest part of the song), tempo, energy and brightness. New songs are analyzed automatically after adding.',
};

// 19 языков интерфейса. Русский и английский — здесь, остальные — в locales/.
export const LANGS = { en, ru, uk, ro, es, it, de, pt, pl, tr, fr, nl, cs, hu, sv, el, bg, hr, lt };
export const LANG_NAMES = {
  en: 'English', ru: 'Русский', uk: 'Українська', ro: 'Română', es: 'Español', it: 'Italiano', de: 'Deutsch',
  pt: 'Português', pl: 'Polski', tr: 'Türkçe', fr: 'Français',
  nl: 'Nederlands', cs: 'Čeština', hu: 'Magyar', sv: 'Svenska', el: 'Ελληνικά', bg: 'Български', hr: 'Hrvatski', lt: 'Lietuvių',
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

/** Форма слова по числу: forms — «один|несколько|много» (правило русского; для английского 2-я и 3-я совпадают). */
function pluralForm(n, forms) {
  const f = String(forms || '').split('|');
  const x = Math.abs(Number(n) || 0) % 100, y = x % 10;
  if (f.length === 2) return Number(n) === 1 ? f[0] : f[1];   // английский и похожие: 1 — одна форма, иначе другая
  if (f.length < 2) return f[0] || '';
  if (x > 10 && x < 20) return f[2];
  if (y === 1) return f[0];
  if (y >= 2 && y <= 4) return f[1];
  return f[2];
}

const LangContext = createContext({ lang: 'ru', t: k => k, setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(deviceLang());
  useEffect(() => { AsyncStorage.getItem('sm_lang').then(l => { if (l && LANGS[l]) setLangState(l); }); }, []);
  const value = useMemo(() => {
    const dict = LANGS[lang] || en;
    const t = (k, p) => {
      let s = dict[k] ?? en[k] ?? k;
      // {songs} — «песня / песни / песен» по числу n (формы — songs_forms: «1|2–4|5+»).
      if (s.includes('{songs}')) s = s.split('{songs}').join(pluralForm(p && p.n, dict.songs_forms || en.songs_forms));
      if (p) for (const n of Object.keys(p)) s = s.split('{' + n + '}').join(String(p[n]));
      return s;
    };
    return { lang, t, setLang: l => { setLangState(l); AsyncStorage.setItem('sm_lang', l); } };
  }, [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
