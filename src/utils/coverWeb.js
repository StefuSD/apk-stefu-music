import { Linking } from 'react-native';

/** Открыть в браузере поиск картинок «исполнитель название cover».
    Найденную картинку можно скопировать по ссылке и вставить через «Обложка по ссылке». */
export function openCoverSearch(artist, title) {
  const q = [artist, title, 'cover'].filter(Boolean).join(' ').trim();
  return Linking.openURL('https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q)).catch(() => {});
}
