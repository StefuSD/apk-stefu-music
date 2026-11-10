# Иконка Stefu Music: белые наушники с полосками эквалайзера на графитовом диагональном градиенте (чёрно-белая).
# Монохромный знак, без фото. Запуск: python assets/mk_icon.py, затем
# npx expo prebuild --platform android --no-install (перепишет mipmap-ресурсы).
from PIL import Image, ImageDraw, ImageFilter
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
N = 1024
TOP, BOT = (78, 77, 82), (10, 10, 11)           # чёрно-белая: светлый графит → почти чёрный (из угла в угол)


def gradient(n, stretch=1.0):
    # stretch > 1 — градиент круче: для адаптивной иконки, где видна только середина
    small = Image.new('RGB', (256, 256))
    px = small.load()
    for y in range(256):
        for x in range(256):
            k = min(1.0, max(0.0, 0.5 + ((x + y) / 510.0 - 0.5) * stretch))
            px[x, y] = tuple(int(TOP[i] + (BOT[i] - TOP[i]) * k) for i in range(3))
    return small.resize((n, n), Image.BICUBIC)


def glyph(n, scale):
    """Белые наушники; scale — доля стороны, которую занимает знак."""
    S = n * 4
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    u = S * scale / 100.0                        # знак рисуется в квадрате 100×100
    o = (S - 100 * u) / 2
    P = lambda x, y: (o + x * u, o + y * u)
    R = lambda x0, y0, x1, y1: [P(x0, y0), P(x1, y1)]
    # оголовье: толстая дуга
    d.arc(R(8, 6, 92, 90), 180, 360, fill=255, width=int(9 * u))
    # стойки от дуги к чашкам
    d.rectangle(R(8, 47, 17, 62), fill=255)
    d.rectangle(R(83, 47, 92, 62), fill=255)
    # чашки
    d.rounded_rectangle(R(2, 56, 26, 96), radius=int(9 * u), fill=255)
    d.rounded_rectangle(R(74, 56, 98, 96), radius=int(9 * u), fill=255)
    # эквалайзер между чашками
    for x, h in ((36, 16), (45.5, 30), (55, 22), (64.5, 10)):
        d.rounded_rectangle(R(x - 3.2, 90 - h, x + 3.2, 90), radius=int(3.2 * u), fill=255)
    m = m.resize((n, n), Image.LANCZOS)
    g = Image.new('RGBA', (n, n), (255, 255, 255, 0))
    g.putalpha(m)
    return g


def with_shadow(base, g):
    a = g.split()[3].filter(ImageFilter.GaussianBlur(N * 0.014))
    sh = Image.new('RGBA', g.size, (35, 8, 70, 0))
    sh.putalpha(a.point(lambda v: int(v * 0.35)))
    base.alpha_composite(sh, (0, int(N * 0.012)))
    base.alpha_composite(g)
    return base


icon = with_shadow(gradient(N).convert('RGBA'), glyph(N, 0.58))
icon.convert('RGB').save('icon.png')
icon.convert('RGB').resize((48, 48), Image.LANCZOS).save('favicon.png')

# адаптивная: знак в безопасной зоне (середина 66/108 после маски)
with_shadow(gradient(N, 108 / 66).convert('RGBA'), glyph(N, 0.58 * 62 / 108)).save('adaptive-icon.png')

# заставка: знак в фиолетовом круге
sp = Image.new('RGBA', (N, N), (0, 0, 0, 0))
mk = Image.new('L', (N * 2, N * 2), 0)
ImageDraw.Draw(mk).ellipse((N * 0.3, N * 0.3, N * 1.7, N * 1.7), fill=255)
circ = gradient(N).convert('RGBA')
circ.putalpha(mk.resize((N, N), Image.LANCZOS))
sp.alpha_composite(circ)
sp.alpha_composite(glyph(N, 0.40))
sp.save('splash-icon.png')

prev = Image.new('RGB', (620, 300), (255, 255, 255))
pm = Image.new('L', (280, 280), 0); ImageDraw.Draw(pm).ellipse((0, 0, 279, 279), fill=255)
fg = Image.open('adaptive-icon.png')
prev.paste(fg.resize((420, 420), Image.LANCZOS).crop((70, 70, 350, 350)), (10, 10), pm)
rm = Image.new('L', (280, 280), 0); ImageDraw.Draw(rm).rounded_rectangle((0, 0, 279, 279), 60, fill=255)
prev.paste(icon.resize((280, 280), Image.LANCZOS), (330, 10), rm)
prev.save(os.environ.get('ICON_PREVIEW', 'icon_preview.png'))
print('ok')

