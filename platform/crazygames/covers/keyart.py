"""Builds the three CrazyGames covers as key art from the game's own sprites: a big capybara firing its
minigun at the Ant Queen, with the title. The sprites come straight out of index.html, so the covers
always match the game. Run from the repo root:

    python platform/crazygames/covers/keyart.py

Writes platform/crazygames/store/cover-landscape-1920x1080.png, cover-portrait-800x1200.png and
cover-square-800x800.png, plus dist/cover-thumbs.png (all three at roughly the size CrazyGames shows them).
Needs Pillow, fontTools and brotli (pip install pillow fonttools brotli).

CrazyGames puts badges ("Hot", "Updated") in a label zone at the top-left of each cover, roughly 36% x 20%
(landscape), 40% x 10% (portrait) and 35% x 30% (square). Nothing important goes there, and the title is
the only text, as CrazyGames requires. The capybara and its minigun come from hd/: a high-resolution redraw
of the capybara (Pixa, Muse Image, from the game sprite) and the minigun sprite upscaled 4x (Pixa upscale),
both cut out of a flat background. Everything else is a game sprite scaled up 3-4x.
"""
import base64, io, json, math, os, random, re
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageEnhance
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
STORE = os.path.join(ROOT, 'platform', 'crazygames', 'store')
LABEL = {'landscape': (0.36, 0.20), 'portrait': (0.40, 0.10), 'square': (0.35, 0.30)}

# ---------- art out of the game ----------
html = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()
ART = {}
for line in html.split('\n'):
    m = re.match(r'const ([A-Z_]+_ART) = (\{.*\});\s*$', line)
    if not m: continue
    def walk(p, v):
        if isinstance(v, dict):
            if 'b64' in v: ART[p] = v['b64']; return
            for k, x in v.items(): walk(p + '_' + k, x)
        elif isinstance(v, list):
            for i, x in enumerate(v): walk(p + '_' + str(i), x)
    walk(m.group(1).replace('_ART', '').lower(), json.loads(m.group(2)))
ART['capy'] = re.search(r"CAPY\.src = 'data:image/webp;base64,([^']+)'", html).group(1)

def sprite(name):
    im = Image.open(io.BytesIO(base64.b64decode(ART[name]))).convert('RGBA')
    return clean(im, 40)
def clean(im, cut=60):
    r, g, b, a = im.split(); return Image.merge('RGBA', (r, g, b, a.point(lambda v: 0 if v < cut else v)))
def up(im, f): return clean(im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS))
def big(name, f):
    """a sprite at f times its game size: from the high-resolution redraw in hd/ when there is one (the capybara
    and the minigun, made with Pixa from the game sprites), otherwise the game sprite scaled up"""
    sp = sprite(name); w, h = round(sp.width * f), round(sp.height * f)
    p = os.path.join(HERE, 'hd', name + '.png')
    if not os.path.exists(p): return up(sp, f)
    return clean(Image.open(p).convert('RGBA').resize((w, h), Image.LANCZOS))
def pad(im, p):
    c = Image.new('RGBA', (im.width + 2 * p, im.height + 2 * p)); c.alpha_composite(im, (p, p)); return c
def outline(im, px, col=(26, 18, 6, 255)):
    im = pad(im, px + 2)
    o = Image.new('RGBA', im.size, col); o.putalpha(im.split()[3].filter(ImageFilter.MaxFilter(px * 2 + 1)))
    o.alpha_composite(im); return o
def paste(base, im, x, y):
    """alpha-composite im at (x, y), clipping anything that falls off the canvas"""
    x, y = round(x), round(y)
    cx, cy = max(0, -x), max(0, -y)
    if cx >= im.width or cy >= im.height: return
    base.alpha_composite(im.crop((cx, cy, im.width, im.height)), (x + cx, y + cy))
def shadow(base, im, x, y, r=25, off=(0, 18), op=150):
    s = Image.new('RGBA', im.size); s.putalpha(im.split()[3].point(lambda v: v * op // 255))
    p = r * 3; s = pad(s, p).filter(ImageFilter.GaussianBlur(r))
    paste(base, s, x + off[0] - p, y + off[1] - p)

os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True); font_path = os.path.join(ROOT, 'dist', 'lilita-one.ttf')
if not os.path.exists(font_path):
    f = TTFont(os.path.join(ROOT, 'fonts', 'lilita-one.woff2')); f.flavor = None; f.save(font_path)

def rot(pt, size, ang, new_size):
    """where a point in an image lands after PIL's rotate(ang, expand=True)"""
    a = math.radians(ang); dx, dy = pt[0] - size[0] / 2, pt[1] - size[1] / 2
    return (new_size[0] / 2 + dx * math.cos(a) + dy * math.sin(a), new_size[1] / 2 - dx * math.sin(a) + dy * math.cos(a))

# ---------- one cover ----------
def cover(shape, W, H, s, capx, drop, qs, qhead, title, ants, seed=4):
    random.seed(seed)
    # ground: the game's grass, darkened, with a warm glow behind the capybara and a vignette
    g = up(sprite('ground_grass'), 1.4 * W / 1920 + 0.35)
    bg = Image.new('RGBA', (W, H))
    for x in range(0, W, g.width):
        for y in range(0, H, g.height): bg.alpha_composite(g, (x, y))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    R = max(W, H)
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((capx - R * 0.3, H - R * 0.5, capx + R * 0.3, H + R * 0.1), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(R * 0.09))
    warm = Image.new('RGBA', (W, H), (255, 190, 80, 0)); warm.putalpha(glow.point(lambda v: int(v * 0.55))); bg.alpha_composite(warm)
    vig = Image.new('L', (W, H), 0); ImageDraw.Draw(vig).ellipse((-W * 0.16, -H * 0.23, W * 1.16, H * 1.23), fill=255)
    vig = ImageOps.invert(vig.filter(ImageFilter.GaussianBlur(R * 0.115)))
    dark = Image.new('RGBA', (W, H), (5, 10, 6, 0)); dark.putalpha(vig.point(lambda v: int(v * 0.85))); bg.alpha_composite(dark)

    # ants charging in, a little darker for depth
    for name, f, fx, fy in ants:
        a = outline(ImageEnhance.Brightness(ImageOps.mirror(up(sprite(name), f))).enhance(0.8), max(2, round(f * 2)))
        x, y = fx * W - a.width / 2, fy * H - a.height / 2
        shadow(bg, a, x, y, 10, (0, 8), 120); paste(bg, a, x, y)

    # the capybara, its minigun and where the barrel ends up
    c = outline(big('capy', s), max(6, round(s * 2)))
    cx, cy = capx - c.width / 2, H - c.height + drop
    grip = (cx + 0.82 * c.width, cy + 0.53 * c.height)            # its front paw
    gun0 = outline(big('gun_gunner_1', s * 0.84), max(4, round(s * 1.4)))
    a0 = gun0.split()[3]; xs = [x for x in range(gun0.width) if any(a0.getpixel((x, y)) for y in range(gun0.height))]
    tip_x = xs[-1]; tip_ys = [y for y in range(gun0.height) if a0.getpixel((tip_x - 3, y))]
    tip0 = (tip_x, sum(tip_ys) / len(tip_ys)); grip0 = (0.55 * gun0.width, 0.46 * gun0.height)
    # aim the barrel at the queen's head
    ang = math.degrees(math.atan2(-(qhead[1] - grip[1]), qhead[0] - grip[0])) - math.degrees(math.atan2(-(tip0[1] - grip0[1]), tip0[0] - grip0[0]))
    gun = gun0.rotate(ang, Image.BICUBIC, expand=True)
    gp, tp = rot(grip0, gun0.size, ang, gun.size), rot(tip0, gun0.size, ang, gun.size)
    gx, gy = grip[0] - gp[0], grip[1] - gp[1]; mx, my = gx + tp[0], gy + tp[1]

    # the queen, mirrored to face the capybara, placed so her head is at qhead
    q = outline(ImageOps.mirror(up(sprite('ant_queen'), qs)), max(4, round(qs * 3)))
    qx, qy = qhead[0] - 0.19 * q.width, qhead[1] - 0.55 * q.height
    shadow(bg, q, qx, qy, 22, (0, 26), 140); paste(bg, q, qx, qy)

    # bullet streaks from the muzzle to the queen
    st = Image.new('RGBA', (W, H)); sd = ImageDraw.Draw(st)
    d = math.hypot(qhead[0] - mx, qhead[1] - my); ux, uy = (qhead[0] - mx) / d, (qhead[1] - my) / d
    n = max(3, int(d / (55 * s / 4.3))); w = max(5, round(12 * s / 4.3))
    for i in range(n):
        t0 = 0.18 + i * 0.75 / n; t1 = t0 + 0.45 / n; j = random.uniform(-1, 1) * 18 * s / 4.3
        sd.line((mx + ux * d * t0 - uy * j, my + uy * d * t0 + ux * j, mx + ux * d * t1 - uy * j, my + uy * d * t1 + ux * j), fill=(255, 232, 150, 255), width=w)
    paste(bg, st.filter(ImageFilter.GaussianBlur(1.2)), 0, 0)

    shadow(bg, c, cx, cy, 30, (10, 30), 170); paste(bg, c, cx, cy)
    shadow(bg, gun, gx, gy, 16, (6, 18), 160); paste(bg, gun, gx, gy)
    # the front paw goes back over the gun, so the capybara is holding it
    pm = Image.new('L', c.size, 0); px, py = 0.85 * c.width, 0.525 * c.height; r = 10.5 * s
    ImageDraw.Draw(pm).ellipse((px - r, py - r * 0.85, px + r * 1.12, py + r * 0.8), fill=255)
    pa = c.copy(); pa.putalpha(Image.composite(c.split()[3], Image.new('L', c.size, 0), pm.filter(ImageFilter.GaussianBlur(s * 1.4))))
    paste(bg, pa, cx, cy)

    # muzzle flash
    fl = Image.new('RGBA', (W, H)); fd = ImageDraw.Draw(fl); k = s / 4.3
    fd.ellipse((mx - 110 * k, my - 90 * k, mx + 110 * k, my + 90 * k), fill=(255, 200, 60, 230))
    fd.ellipse((mx - 60 * k, my - 45 * k, mx + 60 * k, my + 45 * k), fill=(255, 250, 210, 255))
    paste(bg, fl.filter(ImageFilter.GaussianBlur(22 * k)), 0, 0)

    # the title
    tcx, ttop, tw, tilt = title
    t = Image.new('RGBA', (W, H)); td = ImageDraw.Draw(t)
    size = 100; f = ImageFont.truetype(font_path, size)
    size = int(size * tw * W / td.textlength('CAPYBARA', font=f))
    def ot(txt, y, sz, fill):
        f = ImageFont.truetype(font_path, sz); w = td.textlength(txt, font=f)
        td.text((tcx * W - w / 2, y), txt, font=f, fill=fill, stroke_width=round(sz * 0.1), stroke_fill=(26, 18, 6, 255))
    ot('CAPYBARA', ttop * H, size, (255, 210, 58, 255))
    ot('WITH A GUN', ttop * H + size * 0.99, round(size * 0.74), (255, 154, 31, 255))
    t = t.rotate(tilt, Image.BICUBIC, center=(tcx * W, ttop * H + size))
    sh = Image.new('RGBA', (W, H)); sh.putalpha(t.split()[3].point(lambda v: v // 2))
    paste(bg, sh.filter(ImageFilter.GaussianBlur(size * 0.05)), 0, round(size * 0.05)); paste(bg, t, 0, 0)

    # nothing but background in the label zone (the capybara's ear or the title must not reach into it)
    lw, lh = LABEL[shape]
    busy = Image.new('RGBA', (W, H)); paste(busy, c, cx, cy); paste(busy, t, 0, 0); paste(busy, q, qx, qy)
    box = busy.split()[3].crop((0, 0, int(lw * W), int(lh * H))).getbbox()
    if box: print(f'  warning: {shape} has art in the label zone at {box}')
    return bg.convert('RGB')

SHAPES = {
    # shape: (W, H, capybara scale, capybara centre x, how far it drops off the bottom, queen scale, queen head (x, y),
    #         title (centre x, top, width, tilt) as fractions of the cover, ants (sprite, scale, x, y))
    'landscape': (1920, 1080, 4.3, 520, 70, 1.75, (1330, 770), (0.70, 0.04, 0.53, 2.3),
                  [('ant_soldier', 1.3, 0.97, 0.52), ('ant_worker', 1.6, 0.78, 0.91), ('ant_runner', 1.4, 0.95, 0.95), ('ant_soldier', 1.2, 0.62, 0.89)]),
    'portrait':  (800, 1200, 3.3, 215, 20, 0.8, (690, 785), (0.50, 0.12, 0.84, 2.0),
                  [('ant_soldier', 0.9, 0.88, 0.96), ('ant_runner', 1.0, 0.80, 0.42), ('ant_worker', 1.1, 0.93, 0.50)]),
    'square':    (800, 800, 2.6, 215, 40, 1.0, (615, 545), (0.66, 0.05, 0.56, 2.3),
                  [('ant_runner', 0.9, 0.93, 0.93), ('ant_worker', 1.0, 0.60, 0.95)]),
}

if __name__ == '__main__':
    out = {}
    for shape, (W, H, *rest) in SHAPES.items():
        out[shape] = cover(shape, W, H, *rest)
        p = os.path.join(STORE, f'cover-{shape}-{W}x{H}.png'); out[shape].save(p, optimize=True); print('wrote', p)
    # all three at roughly the size CrazyGames shows them, to judge them at a glance
    th = [out['landscape'].resize((320, 180), Image.LANCZOS), out['portrait'].resize((160, 240), Image.LANCZOS), out['square'].resize((180, 180), Image.LANCZOS)]
    sheet = Image.new('RGB', (sum(i.width for i in th) + 80, 280), (30, 31, 42)); x = 20
    for i in th: sheet.paste(i, (x, 20)); x += i.width + 20
    sheet.save(os.path.join(ROOT, 'dist', 'cover-thumbs.png')); print('wrote dist/cover-thumbs.png')
