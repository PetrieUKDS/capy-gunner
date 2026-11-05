// Cover stills for CrazyGames: real gameplay from an autopilot run (reel.js), drawn at the cover's
// exact size, with the game's title on top. CrazyGames allows the title as the only text.
window.COVERS = (() => {
  const T = window.__t, OW = window.__PX, OH = window.__PY, SHAPE = window.__SHAPE;
  const FONT = '"Lilita One", Impact, sans-serif';
  const comp = document.createElement('canvas'); comp.width = OW; comp.height = OH;
  const c = comp.getContext('2d', { alpha: false });

  // a run with a big build, a big swarm and a boss in view; the capybara can't die
  function scene(o = {}) {
    REC.path = o.path ?? 0; REC.near = o.near ?? 200;
    T.SET.flash = false; T.SET.numbers = false; T.start('normal'); T.G.D.dmg = 0.001;
    document.getElementById('hud').hidden = true;
    Object.assign(T.prog.tips, { move: 1, seeds: 1, strike: 1, elite: 1, pickup: 1, sap: 1, evo: 1 });
    const G = T.G; G.nextBoss = 1e9;
    if (o.lap) { G.lap = o.lap; G.bioK = 1; }
    REC.ffwd(50);
    G.p.level = 22; for (let i = 0; i < 34; i++) { T.openLevelUp('xp'); REC.autopick(); }
    G.p.hp = G.p.maxHp; REC.ffwd(o.swarm ?? 110);
    G.bossIdx = o.boss ?? 0; G.ants = G.ants.filter(a => !a.boss); G.spit = [];
    T.spawnBoss();
    for (let i = 0; i < 900 && T.state !== 'play'; i++) { if (T.state === 'intro' && i > 60) T.skipIntro(); REC.step(1 / 60, false); }
    REC.ffwd(o.fight ?? 3);
  }

  // step on until the boss is up, in frame and not too close, with plenty of ants on screen
  function frameUp(o = {}) {
    const G = T.G, vw = innerWidthLogical() / 2, vh = innerHeightLogical() / 2;
    let best = null;
    for (let i = 0; i < (o.tries ?? 240); i++) {
      REC.ffwd(0.1);
      const b = G.boss, p = G.p; if (b) b.hp = Math.max(b.hp, b.maxHp * 0.6); // keep the boss alive until the shot
      if (!b || b.under || b.intro) continue;
      const dx = Math.abs(b.x - p.x), dy = Math.abs(b.y - p.y), below = b.y - p.y;
      // the title sits across the top, so the boss has to be beside or below the capybara
      const inFrame = dx < vw * (o.spanX ?? 0.7) && below > vh * (o.minBelow ?? 0.05) && below < vh * (o.maxBelow ?? 0.5) && Math.hypot(dx, dy) > (o.minDist ?? 150);
      const ants = G.ants.filter(a => !a.dead && !a.under && Math.abs(a.x - p.x) < vw && Math.abs(a.y - p.y) < vh).length;
      if (inFrame && ants >= (o.ants ?? 30)) { best = { ants, dx, dy }; break; }
    }
    G.toast = null; G.banner = null;
    return best;
  }
  // the game's own view size in world units (W / ZOOM), worked out from the logical layout
  const zoom = () => window.__ZOOM || Math.max(0.62, Math.min(1, Math.min(window.__LW, window.__LH) / 720));
  const innerWidthLogical = () => window.__LW / zoom(), innerHeightLogical = () => window.__LH / zoom();

  function outlined(txt, x, y, size, fill) {
    c.font = `${size}px ${FONT}`; c.lineJoin = 'round';
    c.lineWidth = size * 0.2; c.strokeStyle = '#1a1206'; c.strokeText(txt, x, y);
    c.fillStyle = fill; c.fillText(txt, x, y);
  }
  function title() {
    const L = { landscape: { w: 0.5, y: 0.2, shade: 0.42 }, portrait: { w: 0.84, y: 0.15, shade: 0.34 }, square: { w: 0.78, y: 0.19, shade: 0.42 } }[SHAPE];
    // a soft dark band behind the title so it reads on any background
    const g = c.createLinearGradient(0, 0, 0, OH * L.shade);
    g.addColorStop(0, 'rgba(8,14,9,0.62)'); g.addColorStop(1, 'rgba(8,14,9,0)');
    c.fillStyle = g; c.fillRect(0, 0, OW, OH * L.shade);
    c.font = `100px ${FONT}`; const size = Math.round(100 * OW * L.w / c.measureText('CAPYBARA').width);
    c.save(); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    c.translate(OW / 2, OH * L.y); c.rotate(-0.04);
    c.shadowColor = 'rgba(0,0,0,0.45)'; c.shadowBlur = size * 0.12; c.shadowOffsetY = size * 0.06;
    outlined('CAPYBARA', 0, 0, size, '#ffd23a');
    outlined('WITH A GUN', 0, size * 0.92, Math.round(size * 0.74), '#ff9a1f');
    c.restore();
  }
  function render(o = {}) {
    const G = T.G;
    // clean frame: no white hit flashes, screen flashes or floating text, and the camera raised
    // a little so the capybara sits below the title instead of under it
    for (const a of G.ants) a.hitT = 0;
    G.flash = 0; G.texts.length = 0; G.toast = null; G.banner = null;
    G.cam.x = G.p.x; G.cam.y = G.p.y - innerHeightLogical() * (o.lift ?? 0.12);
    T.draw(); c.drawImage(T.cv, 0, 0, OW, OH); title(); return comp;
  }

  async function save(name) {
    const blob = await new Promise(r => comp.toBlob(r, 'image/png'));
    const res = await fetch('http://127.0.0.1:5231/?name=' + encodeURIComponent(name), { method: 'POST', body: blob, headers: { 'Content-Type': 'text/plain' } });
    return (await res.text());
  }

  async function shot(o = {}) {
    await document.fonts.load(`100px ${FONT}`);
    scene(o); const f = frameUp(o); render(o);
    const name = o.name || `cover-${SHAPE}-${OW}x${OH}.png`;
    return { frame: f, saved: o.dry ? 'not saved' : await save(name), boss: T.G.boss && T.BOSSES[T.G.boss.kind].name, area: T.biomeNow().name };
  }
  return { shot, scene, frameUp, render, save, comp };
})();
