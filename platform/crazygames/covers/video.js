// Gameplay preview videos for CrazyGames: 15-20 s, no sound, no text except the opening title
// (the video opens on the cover and the title fades out), played in real time (no fast-forward).
// Open covers.html?shape=vlandscape (1920x1080) or ?shape=vportrait (1080x1620), then
// `await VIDEO.record()`; the clip is posted to receive.mjs and lands in dist/covers/out/.
window.VIDEO = (() => {
  const T = window.__t, OW = window.__PX, OH = window.__PY, SHAPE = window.__SHAPE;
  const comp = document.createElement('canvas'); comp.width = OW; comp.height = OH;
  const c = comp.getContext('2d', { alpha: false });
  const LIFT = SHAPE === 'vportrait' ? 0.08 : 0.1; // matches the covers' framing at the start
  const HOLD = 0.6, FADE = 0.7; // the title stays for HOLD seconds, then fades out over FADE
  let vtrack = null, rec = null, chunks = [], t = 0, showN = 0;
  const ease = k => k * k * (3 - 2 * k);

  // the same run as the covers: a big build in a big swarm, no boss yet
  function setup(o = {}) {
    REC.path = o.path ?? 0; REC.near = o.near ?? 200;
    T.SET.flash = false; T.SET.numbers = false; T.SET.sfx = 0; T.SET.music = 0;
    T.start('normal'); T.G.D.dmg = 0.001; document.getElementById('hud').hidden = true;
    Object.assign(T.prog.tips, { move: 1, seeds: 1, strike: 1, elite: 1, pickup: 1, sap: 1, evo: 1 });
    const G = T.G; G.nextBoss = 1e9;
    REC.ffwd(50);
    G.p.level = 22; for (let i = 0; i < 34; i++) { T.openLevelUp('xp'); REC.autopick(); }
    G.p.hp = G.p.maxHp; REC.ffwd(o.swarm ?? 110); G.toast = null; G.banner = null;
  }

  // frames go to receive.mjs as JPEGs, numbered; encode.mjs turns them into the MP4 with ffmpeg.
  // Rendering is frame by frame (not a live recording), so a hidden or slow browser can't drop frames.
  let prefix = 'f', frameNo = 0, pending = [];
  async function saveFrame() {
    const blob = await new Promise(r => comp.toBlob(r, 'image/jpeg', 0.95));
    const name = `${prefix}-${String(frameNo++).padStart(5, '0')}.jpg`;
    const res = await fetch('http://127.0.0.1:5231/?name=' + name, { method: 'POST', body: blob, headers: { 'Content-Type': 'text/plain' } });
    if (!res.ok) throw new Error('save failed ' + name);
  }
  function draw() {
    const G = T.G; G.toast = null; G.banner = null; G.texts.length = 0;
    for (const a of G.ants) a.hitT = 0; // no constant white hit-flash on the boss under fire
    const k = ease(Math.max(0, Math.min(1, (t - HOLD) / FADE)));
    // ease the camera from the cover's raised framing back to the game's own
    if (T.state === 'play') { G.cam.x = G.p.x; G.cam.y = G.p.y - COVERS.viewH() * LIFT * (1 - k); }
    T.draw(); c.drawImage(T.cv, 0, 0, OW, OH);
    if (k < 1) COVERS.title(c, OW, OH, SHAPE, 1 - k);
    if (recording) pending.push(saveFrame());
  }
  let recording = false;
  // the real game in fixed 1/60 s steps (autopilot, auto level-ups); every other step is a
  // 30 fps video frame, so the clip plays at exactly the game's own speed
  async function play(secs, o = {}) {
    let s = 0;
    while (s < secs && !(o.until && o.until(s))) {
      if (o.each) o.each(s);
      REC.step(1 / 60, false); s += 1 / 60;
      // boss entrances and deaths are letterboxed cut-scenes with text; CrazyGames rejects black
      // bars, so those are played off the record and the clip cuts straight into the fight
      if (recording && T.state === 'play') { t += 1 / 60; if (++showN % 2 === 0) { draw(); if (pending.length > 8) { await Promise.all(pending); pending = []; } } }
    }
    return s;
  }

  async function record(o = {}) {
    await document.fonts.load(`100px ${COVERS.FONT}`);
    setup(o); const G = T.G, log = [];
    // warm-up off the record, so the art is decoded before the first recorded frame
    await play(0.6); t = 0; showN = 0; frameNo = 0; pending = [];
    prefix = o.prefix || SHAPE; recording = true;
    draw(); // first frame: the cover

    // 1. the swarm, with the title fading out (about 4.5 s), charging the airstrike near the end
    await play(4.5, { each: s => { if (s > 3.6) { const p = G.p; p.strike = p.strikeNeed; p.strikeCd = 0; } } });
    // 2. an airstrike (3 s)
    T.callStrike(); G.banner = null; await play(3.0); log.push('strike at ' + t.toFixed(1));
    // 3. the Queen arrives: a short look at the entrance, then the fight
    G.bossIdx = o.boss ?? 0; G.ants = G.ants.filter(a => !a.boss); G.spit = [];
    T.spawnBoss();
    await play(2.6, { until: () => T.state === 'play' });
    if (T.state === 'intro') T.skipIntro();
    await play(1.5, { until: () => T.state === 'play' && !G.intro });
    log.push('fight at ' + t.toFixed(1));
    // 4. the fight, to 19 s of footage; the boss is kept alive so its death cut-scene never starts
    await play(30, { until: () => t >= 19, each: () => { if (G.boss) G.boss.hp = Math.max(G.boss.hp, G.boss.maxHp * 0.35); } });
    log.push('end at ' + t.toFixed(1) + ' state ' + T.state);

    recording = false; await Promise.all(pending); pending = [];
    log.push(`${frameNo} frames as ${prefix}-NNNNN.jpg`, 'seconds ' + (frameNo / 30).toFixed(2));
    return log;
  }
  return { record, setup, play };
})();
