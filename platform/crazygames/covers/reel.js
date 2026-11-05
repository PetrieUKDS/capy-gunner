// Scripted gameplay recorder for social clips: an autopilot plays, the canvas is composited
// with title / boss / end cards at 1080x1920 and recorded to MP4 (with the game's sound).
window.REC = (() => {
  const T = window.__t, OW = 1080, OH = 1920;
  const comp = document.createElement('canvas'); comp.width = OW; comp.height = OH;
  const c = comp.getContext('2d', { alpha: false }); c.fillStyle = '#0e1a10'; c.fillRect(0, 0, OW, OH);
  const FRAME_EVERY = +(new URLSearchParams(location.search).get('every') || 2); let showN = 0, showAcc = 0;
  let o_near = 0, vtrack = null, rec = null, chunks = [], dest = null, title = null, card = null, end = null, pathIdx = 0;
  const FONT = '"Lilita One", Impact, sans-serif';

  function setupAudio() {
    T.audio(); const AC = T.AC; if (!AC) return;
    if (!window.__OUT) { // game sound goes only to the recording, not the speakers
      const g = AC.createGain(); dest = AC.createMediaStreamDestination(); g.connect(dest); window.__OUT = g;
    }
    return AC.state;
  }

  // ---- autopilot: run from ants, shots and marked danger zones; drift towards seeds and chests
  function pilot() {
    const G = T.G, p = G.p; let fx = 0, fy = 0;
    const away = (x, y, R, w) => { const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy; if (d2 < R * R) { const d = Math.sqrt(d2) || 1, k = w * (1 - d / R) ** 2; fx += dx / d * k; fy += dy / d * k; } };
    for (const a of G.ants) if (!a.dead && !a.under) away(a.x, a.y, (a.boss ? 150 : 120) + a.r, a.boss ? 10 : 2);
    for (const s of G.spit) away(s.x, s.y, 110, 5);
    for (const cl of G.clouds || []) away(cl.x, cl.y, cl.r + 50, 8);
    for (const s of G.puddles) away(s.x, s.y, s.r + 40, 3);
    const b = G.boss; if (b && b.mx !== undefined && (b.st === 'aim' || b.st === 'warn')) away(b.mx, b.my, 150, 14);
    if (b && !b.under) { const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1; if (d > (o_near || 220)) { fx += dx / d * 2.5; fy += dy / d * 2.5; } } // keep the boss in shot
    let best = null, bd = 420 * 420;
    for (const g of [...G.chests, ...G.pickups, ...G.melons, ...G.gems]) { const dd = (g.x - p.x) ** 2 + (g.y - p.y) ** 2; if (dd < bd) { bd = dd; best = g; } }
    if (best) { const d = Math.sqrt(bd) || 1; fx += (best.x - p.x) / d * 1.2; fy += (best.y - p.y) / d * 1.2; }
    fx += Math.cos(G.t * 0.35) * 0.35; fy += Math.sin(G.t * 0.27) * 0.35;
    const m = Math.hypot(fx, fy); T.pad.x = m > 0.08 ? fx / m : 0; T.pad.y = m > 0.08 ? fy / m : 0;
  }
  function autopick() {
    const picks = [...document.querySelectorAll('#picks button')]; if (!picks.length) return;
    let b = picks.find(x => x.classList.contains('evo'));
    if (!b && T.G.p.weapon === 'pistol') b = document.getElementById('pick' + pathIdx);
    if (!b) b = picks[Math.floor(Math.random() * picks.length)];
    b.click();
  }
  function step(dt, show = true) {
    if (T.state === 'paused') { T.state = 'play'; document.getElementById('paused').hidden = true; } // the game pauses itself when the window loses focus
    if (T.state === 'levelup') autopick();
    const G = T.G;
    if (T.state === 'play') {
      pilot(); G.hsCd -= dt; if (G.hitStop > 0) G.hitStop -= dt; else T.update(dt);
      const p = G.p; if (p.hp < p.maxHp * 0.4) p.hp = p.maxHp * 0.4; // the star of the show doesn't die on camera
    } else if (T.state === 'intro') T.updateIntro(dt);
    else if (T.state === 'bossdeath') T.updateDeath(dt);
    // the game runs at 60 steps a second but only every other one is drawn and recorded (30 fps), so the encoder keeps up
    if (show) { showAcc += dt; if (++showN % FRAME_EVERY === 0) { T.draw(); compose(showAcc); showAcc = 0; } }
  }

  // ---- overlays
  function outlined(txt, x, y, size, fill, line = '#1a1206', lw = size * 0.16) {
    c.font = `${size}px ${FONT}`; c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = line; c.strokeText(txt, x, y); c.fillStyle = fill; c.fillText(txt, x, y);
  }
  const fade = (t, dur, inT = 0.35, outT = 0.35) => Math.max(0, Math.min(1, t / inT, (dur - t) / outT));
  // the yellow slanted panel from the boss intros: a big name and a line under it, sliding in from the right
  function bossCard(name, sub, k, y = OH * 0.7) {
    if (k <= 0) return;
    c.save(); c.globalAlpha = k; c.translate(OW / 2 + (1 - k) * 300, y); c.rotate(-0.05);
    c.font = `120px ${FONT}`; const w = Math.min(OW - 60, Math.max(c.measureText(name).width + 120, 700));
    c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(-w / 2, -120); c.lineTo(w / 2 + 10, -135); c.lineTo(w / 2 - 6, 90); c.lineTo(-w / 2 + 12, 100); c.closePath(); c.fill();
    c.strokeStyle = '#1a1206'; c.lineWidth = 8; c.stroke();
    c.fillStyle = '#1a1206'; let size = 120; c.font = `${size}px ${FONT}`; while (c.measureText(name).width > w - 80) { size -= 6; c.font = `${size}px ${FONT}`; }
    c.fillText(name, 0, 0);
    size = 40; c.font = `600 ${size}px Rubik, system-ui, sans-serif`; while (c.measureText(sub).width > w - 70) { size -= 2; c.font = `600 ${size}px Rubik, system-ui, sans-serif`; }
    c.fillText(sub, 0, 62); c.restore(); c.globalAlpha = 1;
  }
  function compose(dt) {
    c.drawImage(T.cv, 0, 0, OW, OH);
    queueMicrotask(() => vtrack && rec && rec.state === 'recording' && vtrack.requestFrame());
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const G = T.G;
    if (title) {
      title.t += dt; const a = fade(title.t, title.dur, 0.25, 0.4); c.globalAlpha = a;
      const pop = 1 + 0.15 * Math.max(0, 1 - title.t / 0.3);
      c.save(); c.translate(OW / 2, OH * 0.2); c.scale(pop, pop); c.rotate(-0.04);
      outlined('CAPYBARA', 0, 0, 150, '#ffd23a'); outlined('WITH A GUN', 0, 140, 110, '#ff9a1f');
      c.restore(); c.globalAlpha = 1; if (title.t > title.dur) title = null;
    }
    if (card) { card.t += dt; bossCard(card.name, card.sub, Math.min(1, card.t / 0.25, (card.dur - card.t) / 0.3), card.y); if (card.t > card.dur) card = null; }
    // boss title card while the boss makes its entrance
    const I = G && G.intro;
    if (I && I.card) {
      const B = T.BOSSES[I.b.kind], k = Math.max(0, Math.min(1, (I.t - 2.4) / 0.25, (I.dur - 1.5 - I.t) / 0.3));
      bossCard(B.name, B.sub, k);
    }
    // boss health bar along the bottom during the fight
    if (G && G.boss && !G.intro && T.state === 'play') {
      const b = G.boss, x = 70, y = OH - 190, w = OW - 140;
      c.fillStyle = 'rgba(10,8,4,0.75)'; c.beginPath(); c.roundRect(x - 6, y - 6, w + 12, 52, 14); c.fill();
      c.fillStyle = '#e8503f'; c.beginPath(); c.roundRect(x, y, w * Math.max(0, b.hp / b.maxHp), 40, 10); c.fill();
      c.textAlign = 'left'; outlined(T.BOSSES[b.kind].name, x + 16, y + 32, 34, '#fff', '#1a1206', 6); c.textAlign = 'center';
    }
    if (end) {
      end.t += dt; const a = Math.min(1, end.t / 0.4);
      c.fillStyle = `rgba(8,14,9,${0.72 * a})`; c.fillRect(0, 0, OW, OH);
      c.globalAlpha = a; const pop = 1 + 0.12 * Math.max(0, 1 - end.t / 0.35);
      c.save(); c.translate(OW / 2, OH * 0.38); c.scale(pop, pop); c.rotate(-0.04);
      outlined('CAPYBARA', 0, 0, 150, '#ffd23a'); outlined('WITH A GUN', 0, 140, 110, '#ff9a1f'); c.restore();
      outlined('PLAY FREE IN YOUR BROWSER', OW / 2, OH * 0.58, 64, '#fff');
      const url = 'petrieuk.co.uk/games/capybara-with-a-gun'; let fs = 50; // shrink to fit the width
      do { c.font = `700 ${fs}px Rubik, system-ui, sans-serif`; } while (c.measureText(url).width > OW - 100 && --fs > 20);
      c.fillStyle = '#a6f03c'; c.fillText(url, OW / 2, OH * 0.58 + 90);
      c.font = '600 38px Rubik, system-ui, sans-serif'; c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillText('Phone, keyboard or controller', OW / 2, OH * 0.58 + 160);
      c.globalAlpha = 1;
    }
  }

  // ---- recording
  function begin() {
    vtrack = comp.captureStream(0).getVideoTracks()[0]; // every frame pushed by hand (requestFrame), so none are skipped
    const tracks = [vtrack];
    if (dest) tracks.push(...dest.stream.getAudioTracks());
    rec = new MediaRecorder(new MediaStream(tracks), { mimeType: dest ? 'video/mp4;codecs=avc1.640028,mp4a.40.2' : 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 16e6, audioBitsPerSecond: 192e3 });
    chunks = []; rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; rec.start(1000); rec.pause();
  }
  async function finish(name) {
    rec.state === 'paused' && rec.resume(); await new Promise(r => setTimeout(r, 400));
    await new Promise(r => { rec.onstop = r; rec.stop(); });
    const blob = new Blob(chunks, { type: 'video/mp4' });
    // sent as plain text so the browser doesn't need a CORS preflight
    const res = await fetch('http://127.0.0.1:5230/?name=' + encodeURIComponent(name), { method: 'POST', body: blob, headers: { 'Content-Type': 'text/plain' } });
    return (await res.text()) + ' / ' + blob.size;
  }
  // plays in real time while recording; until() can end it early
  function play(secs, o = {}) {
    rec && rec.state === 'paused' && rec.resume();
    return new Promise(res => {
      let last = performance.now(), t = 0;
      const tick = now => {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
        if (o.each) o.each(t); step(dt);
        if (t >= secs || (o.until && o.until(t))) { ticker.onmessage = null; rec && rec.state === 'recording' && rec.pause(); res(t); }
      };
      // a worker clock keeps ticking even when the window is hidden (animation frames stop then)
      ticker.onmessage = () => tick(performance.now());
    });
  }
  const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 1000 / 60)'], { type: 'text/javascript' })));
  // skips ahead quietly without drawing (the recorder is paused)
  function ffwd(secs) { const s0 = T.SET.sfx; T.SET.sfx = 0; const n = Math.round(secs * 60); for (let i = 0; i < n; i++) step(1 / 60, false); T.SET.sfx = s0; }
  return {
    setupAudio, begin, finish, play, ffwd, step, autopick,
    set path(i) { pathIdx = i; }, set near(d) { o_near = d; },
    title(dur) { title = { t: 0, dur }; }, card(name, sub, dur, y) { card = { name, sub, t: 0, dur, y }; }, end() { end = { t: 0 }; }, clearEnd() { end = null; },
    get rec() { return rec; }, comp
  };
})();

// The reel: title over the early swarm, a maxed-out gun with feature callouts, an airstrike,
// a boss entrance and fight in the Scorched Dunes, then the end card. About 28 seconds.
REC.reel = async (name = 'capy-reel.mp4') => {
  const T = window.__t, log = [];
  REC.setupAudio(); REC.path = 0; T.SET.flash = false; T.start('normal'); T.G.D.dmg = 0.001; document.getElementById('hud').hidden = true; // hits still flash, but never kill
  Object.assign(T.prog.tips, { move: 1, seeds: 1, strike: 1, elite: 1, pickup: 1, sap: 1, evo: 1 });
  let G = T.G; G.nextBoss = 1e9;
  REC.ffwd(55); await REC.play(0.8); REC.begin(); // the unrecorded warm-up decodes the art, so the first frames don't stall
  // 1. title
  REC.title(3.3); await REC.play(3.6); log.push('title ' + G.t.toFixed(0));
  // 2. a big build in a big swarm
  G.p.level = 22;
  for (let i = 0; i < 34; i++) { T.openLevelUp('xp'); REC.autopick(); }
  G.p.hp = G.p.maxHp; REC.ffwd(140); G.toast = null; G.banner = null;
  REC.card('6 WEAPON PATHS', 'Every one evolves into a super gun', 2.9);
  await REC.play(3.1, { each: t => { if (t > 2.2) { const p = G.p; p.strike = p.strikeNeed; p.strikeCd = 0; } } });
  T.callStrike(); G.banner = null; REC.card('AIRSTRIKES', 'Call in the chopper when the swarm gets big', 2.6);
  await REC.play(3.0); log.push('build ' + G.p.evo + ' kills ' + G.kills);
  // 3. a boss in the Scorched Dunes
  G.lap = 1; G.bioK = 1; G.bossIdx = 6; G.ants = G.ants.filter(a => !a.boss); G.spit = []; G.toast = null;
  T.spawnBoss(); REC.ffwd(0.9);
  await REC.play(5.2, { until: () => !G.intro || G.intro.t > 6.0 });
  if (G.intro) T.skipIntro();
  await REC.play(1.4, { until: () => T.state === 'play' && !G.intro });
  const b = G.boss; if (b) b.hp = b.maxHp * 0.55;
  REC.card('11 BOSSES · 3 AREAS', 'Meadow, desert and a swamp at midnight', 2.8, OH_CARD);
  await REC.play(5.0);
  if (G.boss) G.boss.hp = Math.min(G.boss.hp, G.boss.maxHp * 0.02);
  await REC.play(5.5, { until: t => !G.boss && !G.death && t > 1 }); log.push('boss done ' + T.state);
  // 4. end card
  REC.end(); await REC.play(5.4);
  log.push(await REC.finish(name));
  return log;
};
const OH_CARD = 1920 * 0.62;

// Swamp cut: the pyro's flames in the dark of the Midnight Swamp, a drone sidekick, then the Bog King.
REC.swamp = async (name = 'capy-reel-swamp.mp4') => {
  const T = window.__t, log = [];
  REC.setupAudio(); REC.path = 4; T.SET.flash = false; T.start('normal'); T.G.D.dmg = 0.001; document.getElementById('hud').hidden = true; // hits still flash, but never kill
  Object.assign(T.prog.tips, { move: 1, seeds: 1, strike: 1, elite: 1, pickup: 1, sap: 1, evo: 1 });
  let G = T.G; G.nextBoss = 1e9; G.lap = 2; G.bioK = 1; T.biomeNow().dark = 0.2; REC.near = 170;
  REC.ffwd(50); G.toast = null; await REC.play(0.8); G.toast = null; REC.begin(); // warm-up, as above
  // 1. title over the swamp
  REC.title(3.3); await REC.play(3.6); log.push('title ' + G.p.weapon);
  // 2. a burning build, then a sidekick
  G.p.level = 22;
  for (let i = 0; i < 34; i++) { T.openLevelUp('xp'); REC.autopick(); }
  G.p.side = 'drone'; G.p.sideLv = 4; G.p.hp = G.p.maxHp; REC.ffwd(130); G.toast = null; G.banner = null;
  REC.card('PYRO PATH', 'Flamethrowers. In a swamp. At midnight.', 2.9);
  await REC.play(3.2);
  G.banner = null; REC.card('SIDEKICKS', 'A drone buddy or a boomerang', 2.7);
  await REC.play(3.0); log.push('build ' + (G.p.evo || G.p.weapon) + ' kills ' + G.kills);
  // 3. the Bog King
  G.bossIdx = 11; G.ants = G.ants.filter(a => !a.boss); G.spit = []; G.clouds = []; G.toast = null;
  T.spawnBoss(); REC.ffwd(0.9);
  await REC.play(5.2, { until: () => !G.intro || G.intro.t > 6.0 });
  if (G.intro) T.skipIntro();
  await REC.play(1.4, { until: () => T.state === 'play' && !G.intro });
  const b = G.boss; if (b) { b.hp = b.maxHp * 0.55; b.hops = 2; b.st = 'sit'; b.stT = 0.6; } // straight into the tongue
  REC.card('11 BOSSES · 3 AREAS', 'Meadow, desert and a swamp at midnight', 2.8, 1920 * 0.8);
  await REC.play(5.5);
  if (G.boss) G.boss.hp = Math.min(G.boss.hp, G.boss.maxHp * 0.02);
  await REC.play(5.5, { until: t => !G.boss && !G.death && t > 1 }); log.push('boss done ' + T.state);
  // 4. end card
  REC.end(); await REC.play(5.4);
  log.push(await REC.finish(name));
  return log;
};
