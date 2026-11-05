"""Builds dist/covers/: a copy of the game with hooks for taking cover stills at any size, plus
the fonts. The real index.html is untouched. Based on capy-reel's mkreel.py (reel.js is the same
autopilot it uses). Run from the repo root:

    python platform/crazygames/covers/mkcovers.py

Then serve dist/covers on localhost:5261 (preview `capybara-covers`), run
`node platform/crazygames/covers/receive.mjs` to save what the page sends, open
covers.html?shape=landscape|portrait|square and call `await COVERS.shot()`.
"""
import os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'dist', 'covers')

s = open(os.path.join(ROOT, 'index.html'), encoding='utf8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'{n} x {old[:70]!r}'
    s = s.replace(old, new)

# the page lays the game out at a fixed logical size (__LW x __LH) and draws it at __PX pixels wide
rep("  DPR = SET.low ? 1 : Math.min(1.5, window.devicePixelRatio || 1);", "  DPR = window.__LW ? window.__PX / window.__LW : (SET.low ? 1 : Math.min(1.5, window.devicePixelRatio || 1));")
rep("  W = innerWidth; H = innerHeight;", "  W = window.__LW || innerWidth; H = window.__LH || innerHeight;")
rep("  ZOOM = Math.max(0.62, Math.min(1, Math.min(W, H) / 720));", "  ZOOM = window.__ZOOM || Math.max(0.62, Math.min(1, Math.min(W, H) / 720));")
rep(".connect(AC.destination)", ".connect(window.__OUT || AC.destination)", 3)
rep("const TOUCH = matchMedia('(pointer: coarse)').matches,", "const TOUCH = false,")
rep("function frame(now) {\n", "function frame(now) {\n  if (window.__manual) { last = now; requestAnimationFrame(frame); return; }\n")
hook = """window.__t = { get G() { return G; }, get state() { return state; }, set state(v) { state = v; }, get AC() { return AC; }, cv, audio, start, update, draw, updateIntro, updateDeath,
  skipIntro, spawnBoss, openLevelUp, callStrike, pad, prog, BOSSES, SET, biomeNow, hud };
"""
i = s.rindex('})();\n</script>')
s = s[:i] + hook + s[i:]
boot = """<script>
const __shape = new URLSearchParams(location.search).get('shape') || 'landscape';
const __SIZES = { landscape: [960, 540, 1920, 1080, 1.1], portrait: [540, 810, 800, 1200, 0.95], square: [540, 540, 800, 800, 0.95] };
[window.__LW, window.__LH, window.__PX, window.__PY, window.__ZOOM] = __SIZES[__shape];
const __z = new URLSearchParams(location.search).get('zoom'); if (__z) window.__ZOOM = +__z; window.__manual = true; window.__SHAPE = __shape;
</script>"""
rep('<meta charset="utf-8">', '<meta charset="utf-8">\n' + boot)
for f in ('reel.js', 'covers.js'):
    s += '\n<script>\n' + open(os.path.join(HERE, f), encoding='utf8').read() + '\n</script>\n'

os.makedirs(OUT, exist_ok=True)
open(os.path.join(OUT, 'covers.html'), 'w', encoding='utf8', newline='\n').write(s)
shutil.copytree(os.path.join(ROOT, 'fonts'), os.path.join(OUT, 'fonts'), dirs_exist_ok=True)
print('ok', os.path.join(OUT, 'covers.html'), len(s))
