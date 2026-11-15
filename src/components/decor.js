// Монохромный декор шапки для тематических оформлений (src/data/appThemes.js → decor).
//
// Устройство:
//  • У каждой темы свой набор мотивов (DECOR): силуэты рисуются в поле 20×20 (−10…10) — заливкой
//    или линией с круглыми концами — и все одного цвета (цвет текста шапки), различаются только
//    прозрачностью. Так декор не спорит ни с заголовком, ни с обложками.
//  • Раскладка — сетка с дрожанием (jittered grid): по одному элементу в ячейке, сдвиг внутри ячейки.
//    Получается ровно, без комков и наложений, в отличие от чистого случая.
//  • Плотность растёт слева направо: под заголовком слева декора меньше, у кнопок справа — больше
//    (как свечение «сверху справа»).
//  • Три слоя глубины: дальний — мелкий и бледный, ближний — крупнее и заметнее;
//    в левой половине ближнего слоя нет, чтобы не мешать заголовку.
//  • Детерминированно: та же тема и тот же размер шапки → тот же рисунок при каждом показе.
//  • Толщина линии не тоньше 1 px при любом масштабе.

const rad = a => (a * Math.PI) / 180;
const rot = ([x, y], a) => [x * Math.cos(rad(a)) - y * Math.sin(rad(a)), x * Math.sin(rad(a)) + y * Math.cos(rad(a))];
const f = n => Math.round(n * 100) / 100;
const seg = (a, b) => `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;

/** Линии луча, повторённые n раз по кругу. lines — отрезки [[x1,y1],[x2,y2]] для луча, смотрящего вверх. */
function radial(n, lines) {
  let d = '';
  for (let i = 0; i < n; i++) for (const [a, b] of lines) d += seg(rot(a, (360 / n) * i), rot(b, (360 / n) * i));
  return d;
}

/** Замкнутый контур, повторённый n раз по кругу (лепестки, лучи-капли). */
function radialPath(n, pts) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts.map(q => rot(q, (360 / n) * i));
    d += `M${f(p[0][0])} ${f(p[0][1])}C${p.slice(1).map(q => `${f(q[0])} ${f(q[1])}`).join(' ')}Z`;
  }
  return d;
}

const polygon = pts => 'M' + pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L') + 'Z';
const mirrorPoly = right => polygon([...right, ...right.slice(1, -1).reverse().map(([x, y]) => [-x, y])]);
const starPts = (n, R, r) => Array.from({ length: n * 2 }, (_, i) => rot([0, -(i % 2 ? r : R)], (180 / n) * i));
const ring = r => `M${-r} 0A${r} ${r} 0 1 0 ${r} 0A${r} ${r} 0 1 0 ${-r} 0Z`;

// Ветка снежинки: отрезок «вверх» от точки на луче под углом ±a.
const twig = (r, len, a) => [[[0, -r], rot([0, -len], -a).map((v, i) => v + [0, -r][i])], [[0, -r], rot([0, -len], a).map((v, i) => v + [0, -r][i])]];

// Силуэты. part: { d, fill?: true, sw?: толщина линии в единицах поля, evenodd?: true }.
export const SHAPES = {
  // Снежинки — шесть лучей, разные ветки.
  flakeA: [{ d: radial(6, [[[0, 0], [0, -10]], ...twig(4, 3.4, 48), ...twig(7, 2.4, 48)]), sw: 1.5 }],
  flakeB: [{ d: radial(6, [[[0, -2.6], [0, -10]], ...twig(6.2, 3.6, 60)]) + polygon(Array.from({ length: 6 }, (_, i) => rot([0, -2.6], 60 * i))), sw: 1.4 }],
  flakeC: [{ d: radial(6, [[[0, 0], [0, -9.5]], ...twig(2.8, 2, 55), ...twig(5.2, 3, 55), ...twig(7.8, 1.7, 55)]), sw: 1.3 }],
  // Звёзды и искры.
  sparkle: [{ d: 'M0 -10C1 -2.4 2.4 -1 10 0C2.4 1 1 2.4 0 10C-1 2.4 -2.4 1 -10 0C-2.4 -1 -1 -2.4 0 -10Z', fill: true }],
  star: [{ d: polygon(starPts(5, 9.5, 4)), fill: true }],
  dot: [{ d: ring(2.2), fill: true }],
  // Хэллоуин.
  bat: [{ d: 'M0 -3L1 -4.6L1.6 -2.7C4 -3.6 7 -4 10 -2C8.2 -1.4 7.6 0 7.7 1.6C6.6 0.6 5 0.6 4 1.7C3.4 0.6 2.2 0.4 1.2 1.2L0 3L-1.2 1.2C-2.2 0.4 -3.4 0.6 -4 1.7C-5 0.6 -6.6 0.6 -7.7 1.6C-7.6 0 -8.2 -1.4 -10 -2C-7 -4 -4 -3.6 -1.6 -2.7L-1 -4.6Z', fill: true }],
  // месяц: круг R=9 минус круг r=8 со сдвигом 4 вправо; точки пересечения (4,13; ±8)
  moon: [{ d: 'M4.13 -8A9 9 0 1 0 4.13 8A8 8 0 1 1 4.13 -8Z', fill: true }],
  // Сердца.
  heart: [{ d: 'M0 8C-5 4 -9.5 1 -9.5 -3.5C-9.5 -6.6 -7.2 -8.6 -4.8 -8.6C-2.8 -8.6 -1 -7.5 0 -5.8C1 -7.5 2.8 -8.6 4.8 -8.6C7.2 -8.6 9.5 -6.6 9.5 -3.5C9.5 1 5 4 0 8Z', fill: true }],
  heartLine: [{ d: 'M0 8C-5 4 -9.5 1 -9.5 -3.5C-9.5 -6.6 -7.2 -8.6 -4.8 -8.6C-2.8 -8.6 -1 -7.5 0 -5.8C1 -7.5 2.8 -8.6 4.8 -8.6C7.2 -8.6 9.5 -6.6 9.5 -3.5C9.5 1 5 4 0 8Z', sw: 1.5 }],
  // Цветы и лепестки.
  blossom: [{ d: radialPath(5, [[0, -1.2], [-3.4, -4], [-3.2, -9.6], [0, -9.6], [3.2, -9.6], [3.4, -4], [0, -1.2]]), fill: true }],
  sakura: [{ d: radialPath(5, [[0, -1], [-3.8, -4], [-3.6, -9], [-1.6, -9.8], [-0.8, -10.1], [-0.2, -9.6], [0, -8.4], [0.2, -9.6], [0.8, -10.1], [1.6, -9.8], [3.6, -9], [3.8, -4], [0, -1]]), fill: true }],
  petal: [{ d: 'M0 9C-5 5 -5.4 -3.6 -2.4 -9L0 -7.2L2.4 -9C5.4 -3.6 5 5 0 9Z', fill: true }],
  // Листья и деревья.
  leaf: [{ d: 'M0 -10C6 -5 6 4 0 8C-6 4 -6 -5 0 -10Z', fill: true }, { d: 'M0 8L0 10.5', sw: 1.4 }],
  maple: [
    { d: mirrorPoly([[0, -10], [1.5, -6.6], [3.4, -7.6], [3, -4.4], [6.6, -6], [5.9, -3.4], [9.4, -3], [7.4, -1], [8.6, 0.6], [4.6, 1.2], [5.3, 3.6], [1.2, 2.2], [0, 3.6]]), fill: true },
    { d: 'M0 3L0 10', sw: 1.4 },
  ],
  pine: [{ d: mirrorPoly([[0, -10], [4, -4.2], [2, -4.2], [6, 1], [3, 1], [7.5, 6.2], [0, 6.2]]) + 'M-1.1 6.2H1.1V9.6H-1.1Z', fill: true }],
  // Вода и небо.
  wave: [{ d: 'M-10 0Q-7.5 -3.4 -5 0T0 0T5 0T10 0', sw: 1.6 }],
  bubble: [{ d: ring(7), sw: 1.3 }, { d: 'M-4.2 -2A4.6 4.6 0 0 1 -1.6 -4.4', sw: 1.3 }],
  bird: [{ d: 'M-9.5 -0.5Q-4.8 -5.4 0 1Q4.8 -5.4 9.5 -0.5', sw: 1.5 }],
  sun: [{ d: ring(3.6), fill: true }, { d: radial(8, [[[0, -5.8], [0, -9.2]]]), sw: 1.5 }],
  planet: [{ d: ring(4.4), fill: true }, { d: 'M-9.5 1.8C-9.5 -0.6 9.5 -4.4 9.5 -1.8C9.5 0.4 -9.5 4.2 -9.5 1.8Z', sw: 1.1 }],
  // Праздник и музыка.
  note: [
    { d: 'M-5.6 6.4C-5.6 4.4 -3.4 3.2 -1.4 3.6C0.2 3.9 0.8 5 0.6 6.2C0.3 7.9 -1.6 9 -3.4 8.8C-4.7 8.6 -5.6 7.7 -5.6 6.4Z', fill: true },
    { d: 'M0 5.6V-9C0.8 -6 5 -5.4 4.2 -1.4', sw: 1.5 },
  ],
  squiggle: [{ d: 'M-8 2Q-6 -3 -4 2T0 2T4 2T8 2', sw: 1.5 }],
  strip: [{ d: 'M-1.6 -6H1.6V6H-1.6Z', fill: true }],
  circle: [{ d: ring(4.4), sw: 1.6 }],
  balloon: [
    { d: 'M0 -10C4.6 -10 6.6 -6.6 6.6 -3.6C6.6 0.4 3.2 3.4 0 4C-3.2 3.4 -6.6 0.4 -6.6 -3.6C-6.6 -6.6 -4.6 -10 0 -10Z M0 4L1.3 5.6H-1.3Z', fill: true },
    { d: 'M0 5.6C-1.6 7 1.6 8.2 0 10.5', sw: 1.2 },
  ],
  bean: [{ d: 'M0 -9C3.6 -9 6.4 -5 6.4 0C6.4 5 3.6 9 0 9C-3.6 9 -6.4 5 -6.4 0C-6.4 -5 -3.6 -9 0 -9Z M0.4 -7.4C-2.6 -3 2.8 2.4 -0.4 7.4C3.4 2.4 -1.6 -3 0.4 -7.4Z', fill: true, evenodd: true }],
};

// Наборы мотивов. m: [силуэт, вес, поворот ±градусов (360 — любой), макс. штук (необяз.)].
// size — сторона силуэта ближнего слоя в px; cell — шаг сетки в px; fill — доля занятых ячеек.
export const DECOR = {
  snow:      { size: 25, cell: 40, fill: 0.95, m: [['flakeA', 4, 30], ['flakeB', 3, 30], ['flakeC', 3, 30], ['dot', 3, 0]] },
  newyear:   { size: 21, cell: 40, fill: 0.9, m: [['flakeA', 3, 30], ['flakeC', 2, 30], ['sparkle', 4, 15], ['dot', 3, 0]] },
  christmas: { size: 21, cell: 40, fill: 0.9, m: [['flakeB', 3, 30], ['flakeA', 2, 30], ['star', 3, 20], ['dot', 3, 0]] },
  halloween: { size: 22, cell: 44, fill: 0.85, m: [['bat', 4, 15], ['star', 2, 20], ['dot', 3, 0], ['moon', 2, 10, 1]] },
  hearts:    { size: 19, cell: 42, fill: 0.85, m: [['heart', 4, 20], ['heartLine', 3, 20], ['dot', 2, 0]] },
  blossom:   { size: 21, cell: 42, fill: 0.9, m: [['blossom', 4, 36], ['leaf', 2, 360], ['dot', 2, 0]] },
  sakura:    { size: 20, cell: 40, fill: 0.9, m: [['sakura', 3, 36], ['petal', 5, 360]] },
  summer:    { size: 21, cell: 44, fill: 0.85, m: [['sun', 2, 22, 2], ['bird', 3, 12], ['sparkle', 2, 15], ['dot', 3, 0]] },
  ocean:     { size: 21, cell: 42, fill: 0.9, m: [['wave', 4, 6], ['bubble', 4, 0], ['dot', 2, 0]] },
  autumn:    { size: 22, cell: 42, fill: 0.9, m: [['maple', 5, 360], ['leaf', 3, 360]] },
  forest:    { size: 22, cell: 42, fill: 0.9, m: [['pine', 4, 0], ['leaf', 3, 360], ['dot', 1, 0]] },
  birds:     { size: 22, cell: 44, fill: 0.85, m: [['bird', 6, 12], ['sun', 1, 22, 1], ['dot', 2, 0]] },
  space:     { size: 20, cell: 38, fill: 0.95, m: [['sparkle', 4, 15], ['star', 2, 20], ['dot', 6, 0], ['planet', 2, 25, 1]] },
  party:     { size: 20, cell: 40, fill: 0.9, m: [['note', 4, 15], ['squiggle', 3, 60], ['strip', 3, 360], ['circle', 2, 0]] },
  coffee:    { size: 19, cell: 42, fill: 0.85, m: [['bean', 5, 360], ['dot', 2, 0]] },
  birthday:  { size: 21, cell: 42, fill: 0.9, m: [['balloon', 4, 12], ['strip', 3, 360], ['squiggle', 2, 60], ['sparkle', 2, 15]] },
};

// Слои глубины: доля, масштаб, непрозрачность.
const LAYERS = [
  { p: 0.42, k: 0.55, o: 0.15 },
  { p: 0.36, k: 0.8, o: 0.24 },
  { p: 0.22, k: 1.1, o: 0.36 },
];

// Детерминированные «случайные» числа (mulberry32).
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

/**
 * Раскладка декора: [{ shape, x, y, s (px на единицу поля), r (поворот), o (непрозрачность) }].
 * small — превью темы в настройках: мельче шаг и силуэты.
 */
export function layoutDecor(kind, w, h, small) {
  const spec = DECOR[kind];
  if (!spec || !w || !h) return [];
  const r = rng(hash(kind));
  const zoom = small ? 0.62 : 1;
  const cell = spec.cell * zoom;
  const cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const total = spec.m.reduce((a, x) => a + x[1], 0);
  const used = {};
  const out = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      // дрожание внутри ячейки; поля 18 % — соседи не налезают друг на друга
      const x = (gx + 0.18 + r() * 0.64) * cell;
      const y = (gy + 0.18 + r() * 0.64) * cell;
      const pick = r(), layerR = r(), turn = r(), op = r();
      // плотность: слева (под заголовком) реже, справа — полная
      const want = spec.fill * (0.4 + 0.6 * Math.pow(x / w, 0.8));
      if (pick > want || x > w || y > h) continue;
      let acc = (pick / want) * total, m = spec.m[spec.m.length - 1];
      for (const c of spec.m) { acc -= c[1]; if (acc <= 0) { m = c; break; } }
      const [shape, , spin, max] = m;
      if (max && (used[shape] || 0) >= max) continue;
      used[shape] = (used[shape] || 0) + 1;
      let L = LAYERS[2];
      for (let i = 0, a = layerR; i < LAYERS.length; i++) { a -= LAYERS[i].p; if (a <= 0) { L = LAYERS[i]; break; } }
      // тихая зона: в левой половине (заголовок, текст поиска) — без крупных ближних элементов
      if (x < w * 0.55 && L === LAYERS[2]) L = LAYERS[0];
      const k = shape === 'dot' ? 0.5 : L.k;     // точки — всегда мелкие: заполняют паузы
      const sizePx = spec.size * zoom * k;
      out.push({
        shape, x, y,
        s: sizePx / 20,
        r: spin >= 360 ? turn * 360 : (turn * 2 - 1) * spin,
        o: L.o * (0.85 + op * 0.3),
      });
    }
  }
  return out;
}
