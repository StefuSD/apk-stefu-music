// Исполнители песни: у каждого своё поле (song.artists), а для показа,
// поиска и экрана блокировки — одна строка через интерпункт (song.artist).

export const SEP = ' · ';

/** «A feat. B & C», «A; B», «A / B», «A, B», «A · B» → ['A', 'B', 'C']. */
export function splitArtists(text) {
  return (text || '')
    .split(/\s+(?:feat\.?|ft\.?|featuring|x|vs\.?)\s+|\s*[;·,]\s*|\s+\/\s+|\s+&\s+/i)
    .map(s => s.trim())
    .filter(Boolean)
    .filter((s, i, a) => a.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i);
}

export const joinArtists = (list) => (list || []).map(s => s.trim()).filter(Boolean).join(SEP);

/** Список исполнителей песни (для старых записей — из строки artist). */
export const artistsOf = (song) => (song && song.artists && song.artists.length ? song.artists : splitArtists(song && song.artist));
