// Проверка ссылок com.stefu.music://… (src/links/links.js). Запуск: node tests/links.test.mjs
import assert from 'node:assert/strict';
import { parseLink, pickSongs, normLang, wordMatch } from '../src/links/links.js';
const P = parseLink;
assert.equal(P('https://x'), null);
assert.equal(P('com.stefu.contacts://play'), null);
assert.equal(P('com.stefu.music://unknown'), null);
assert.deepEqual(P('com.stefu.music://'), { action: 'library' });
assert.deepEqual(P('com.stefu.music.shots://pause'), { action: 'pause' });
assert.deepEqual(P('com.stefu.music://play?q=%D0%93%D1%80%D1%83%D0%BF%D0%BF%D0%B0+%D0%BA%D1%80%D0%BE%D0%B2%D0%B8&x=1'), { action: 'play', q: 'Группа крови' });
assert.deepEqual(P('com.stefu.music://favorites?shuffle=1'), { action: 'play', fav: true, shuffle: true });
assert.deepEqual(P('com.stefu.music://shuffle'), { action: 'play', shuffle: true });
assert.deepEqual(P('com.stefu.music://play?lang=английский&shuffle=true'), { action: 'play', lang: 'en', shuffle: true });
assert.deepEqual(P('com.stefu.music://play?lang=на%20русском'), { action: 'play', lang: 'ru' });
assert.deepEqual(P('com.stefu.music://reports?period=week'), { action: 'reports', period: 'week' });
assert.deepEqual(P('com.stefu.music://reports?period=bogus'), { action: 'reports' });
assert.deepEqual(P('com.stefu.music://play/Кино'), { action: 'play', q: 'Кино' });
assert.deepEqual(P('com.stefu.music://play?q=%E0%A4'), { action: 'play', q: '%E0%A4' });
assert.deepEqual(P('COM.STEFU.MUSIC://Next'), { action: 'next' });
assert.deepEqual(P('com.stefu.music://play?artist=+&tag=спорт'), { action: 'play', tag: 'спорт' });
assert.equal(normLang('Английский'), 'en'); assert.equal(normLang('без слов'), 'none'); assert.equal(normLang('эсперанто'), 'Эсперанто');
assert.ok(wordMatch('цоя', 'цой')); assert.ok(wordMatch('земфиру', 'земфира')); assert.ok(!wordMatch('кино', 'кинотеатр') === false);
assert.ok(!wordMatch('и', 'имя')); assert.ok(!wordMatch('рок', 'рай'));
const songs = [
 { id: '1', title: 'Группа крови', artists: ['Кино'], artist: 'Кино', tags: ['рок'], langs: ['ru'], addedAt: 1 },
 { id: '2', title: 'Кукушка', artists: ['Кино'], artist: 'Кино', tags: ['рок'], langs: ['ru'], addedAt: 2, fav: true },
 { id: '3', title: 'Yesterday', artists: ['The Beatles'], artist: 'The Beatles', tags: ['вечер'], langs: ['en'], addedAt: 3, fav: true },
 { id: '4', title: 'Хочешь', artists: ['Земфира'], artist: 'Земфира', tags: ['спорт'], genre: 'Rock', langs: ['ru'], addedAt: 4 },
 { id: '5', title: 'Звезда по имени Солнце', artists: ['Виктор Цой'], artist: 'Виктор Цой', langs: ['ru'], addedAt: 5 },
];
const ids = a => pickSongs(a, songs).map(s => s.id);
assert.deepEqual(ids({ q: 'группа крови' }), ['1']);
assert.deepEqual(ids({ q: 'Кино группа крови' })[0], '1');
assert.deepEqual(ids({ q: 'кино' }).sort(), ['1', '2']);
assert.deepEqual(ids({ artist: 'кино' }).sort(), ['1', '2']);
assert.deepEqual(ids({ q: 'цоя' }), ['5']);
assert.deepEqual(ids({ q: 'земфиру' }), ['4']);
assert.deepEqual(ids({ q: 'битлз' }), []);
assert.deepEqual(ids({ q: 'beatles' }), ['3']);
assert.deepEqual(ids({ fav: true }).sort(), ['2', '3']);
assert.deepEqual(ids({ lang: 'en' }), ['3']);
assert.deepEqual(ids({ tag: 'Спорт' }), ['4']);
assert.deepEqual(ids({ genre: 'rock' }), ['4']);
assert.deepEqual(ids({ q: 'рок' }).sort(), ['1', '2']);
assert.deepEqual(ids({ q: 'несуществующая' }), []);
console.log('OK');
