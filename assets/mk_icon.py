# Иконка Stefu Music: две белые ноты под толстой наклонной перекладиной (правая выше) на графитовом диагональном градиенте (чёрно-белая).
# Монохромный знак, без фото. Запуск: python assets/mk_icon.py, затем
# npx expo prebuild --platform android --no-install (перепишет mipmap-ресурсы).
from PIL import Image, ImageDraw, ImageFilter
import math, os
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
    """Две белые ноты под общей толстой наклонной перекладиной; правая выше.
    scale — доля стороны, которую занимает знак."""
    S = n * 4
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    u = S * scale / 100.0                        # знак рисуется в квадрате 100×100
    o = (S - 100 * u) / 2
    K = 0.88                                     # сам знак 76×100, ужат, по центру и чуть левее
    P = lambda x, y: (o + (6 + K * (x + 9)) * u, o + (6 + K * y) * u)

    def head(cx, cy, rx=13.4, ry=11.8, ang=-18):
        a = math.radians(ang)
        pts = []
        for i in range(120):
            t = 2 * math.pi * i / 120
            x, y = rx * math.cos(t), ry * math.sin(t)
            pts.append(P(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
        d.polygon(pts, fill=255)

    head(13, 88)                                 # левая нота (ниже)
    head(63, 75.5)                               # правая нота (выше)
    d.polygon([P(20.3, 19), P(26.1, 19), P(26.1, 88), P(20.3, 88)], fill=255)   # левый штиль
    d.polygon([P(70.3, 1), P(76.2, 0), P(76.2, 75.5), P(70.3, 75.5)], fill=255) # правый штиль
    d.polygon([P(20.3, 18.8), P(76.2, 0), P(76.2, 25), P(20.3, 43.8)], fill=255) # перекладина
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


icon = with_shadow(gradient(N).convert('RGBA'), glyph(N, 0.68))
icon.convert('RGB').save('icon.png')
icon.convert('RGB').resize((48, 48), Image.LANCZOS).save('favicon.png')

# адаптивная: знак в безопасной зоне (середина 66/108 после маски)
with_shadow(gradient(N, 108 / 66).convert('RGBA'), glyph(N, 0.68 * 62 / 108)).save('adaptive-icon.png')

# Заставка — как в Stefu Football (правило для всех приложений Stefu): знак-силуэт без круга,
# под ним название тонким Roboto Light с разрядкой. Светлая и тёмная; те же картинки и размер 288 dp
# в App.js (экран загрузки), чтобы при переходе от системной заставки ничего не прыгало.
APP_NAME = 'Stefu Music'
SPLASH = {'mark': 0.44, 'mark_cy': 0.38, 'text': 0.102, 'text_cy': 0.76, 'tracking': 0.06}
FONT = 'C:/Windows/Fonts/Roboto-Light.ttf'


def splash(n=N, dark=False):
    from PIL import ImageFont
    ink = (237, 242, 239, 255) if dark else (17, 24, 20, 255)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    a = glyph(n, 0.9).split()[3]
    a = a.crop(a.getbbox())
    h = int(n * SPLASH['mark'])
    a = a.resize((max(1, round(a.size[0] * h / a.size[1])), h), Image.LANCZOS)
    mark = Image.new('RGBA', a.size, ink[:3] + (0,))
    mark.putalpha(a)
    img.alpha_composite(mark, (int(n / 2 - a.size[0] / 2), int(n * SPLASH['mark_cy'] - h / 2)))
    S = 4
    big = Image.new('RGBA', (n * S, n * S), (0, 0, 0, 0))
    f = ImageFont.truetype(FONT, int(n * SPLASH['text'] * S))
    d = ImageDraw.Draw(big)
    gap = n * SPLASH['text'] * S * SPLASH['tracking']
    widths = [d.textlength(ch, font=f) for ch in APP_NAME]
    x = n * S / 2 - (sum(widths) + gap * (len(APP_NAME) - 1)) / 2
    for ch, w in zip(APP_NAME, widths):
        d.text((x, n * SPLASH['text_cy'] * S), ch, font=f, fill=ink, anchor='lm')
        x += w + gap
    img.alpha_composite(big.resize((n, n), Image.LANCZOS))
    return img


sp, sp_dark = splash(), splash(dark=True)
sp.save('splash-icon.png')
sp_dark.save('splash-icon-dark.png')

# сразу в ресурсы Android (без expo prebuild): drawable-*/splashscreen_logo.png и тёмные drawable-night-*
RES = os.path.join('..', 'android', 'app', 'src', 'main', 'res')
if os.path.isdir(RES):
    for folder in os.listdir(RES):
        if not folder.startswith('drawable-') or folder.startswith('drawable-night'):
            continue
        p = os.path.join(RES, folder, 'splashscreen_logo.png')
        if not os.path.exists(p):
            continue
        with Image.open(p) as old:
            size = old.size
        sp.resize(size, Image.LANCZOS).save(p)
        night = os.path.join(RES, folder.replace('drawable-', 'drawable-night-'))
        os.makedirs(night, exist_ok=True)
        sp_dark.resize(size, Image.LANCZOS).save(os.path.join(night, 'splashscreen_logo.png'))

prev = Image.new('RGB', (620, 300), (255, 255, 255))
pm = Image.new('L', (280, 280), 0); ImageDraw.Draw(pm).ellipse((0, 0, 279, 279), fill=255)
fg = Image.open('adaptive-icon.png')
prev.paste(fg.resize((420, 420), Image.LANCZOS).crop((70, 70, 350, 350)), (10, 10), pm)
rm = Image.new('L', (280, 280), 0); ImageDraw.Draw(rm).rounded_rectangle((0, 0, 279, 279), 60, fill=255)
prev.paste(icon.resize((280, 280), Image.LANCZOS), (330, 10), rm)
prev.save(os.environ.get('ICON_PREVIEW', 'icon_preview.png'))
print('ok')

