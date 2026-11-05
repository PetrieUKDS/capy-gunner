// CrazyGames adapter for Capybara with a Gun. Only the CrazyGames build loads this file; the
// petrieuk.co.uk build never sees it. It starts the CrazyGames SDK, then loads game.js, and
// talks to the game through the small hook the build adds at the end of the game's closure.
(() => {
  'use strict';
  let sdk = null;
  const log = (...a) => { try { console.info('[crazygames]', ...a); } catch (e) {} };
  const call = (fn) => { if (!sdk) return; try { fn(sdk); } catch (e) { log('sdk call failed', e); } };

  // Saves: route the game's capy-* localStorage keys through the SDK data module, so progress
  // follows a signed-in CrazyGames account. Guests still end up in localStorage (the SDK does
  // that itself). If the data module is switched off or throws, fall back to plain localStorage.
  function routeSaves() {
    const P = Storage.prototype, get = P.getItem, set = P.setItem, del = P.removeItem;
    let inside = false; // the SDK may use localStorage itself; never route its own calls back to it
    const ours = (store, k) => !inside && store === window.localStorage && typeof k === 'string' && k.startsWith('capy-');
    const via = (fn, fallback) => { inside = true; try { return fn(); } catch (e) { return fallback(); } finally { inside = false; } };
    P.getItem = function (k) {
      if (!ours(this, k)) return get.call(this, k);
      return via(() => { const v = sdk.data.getItem(k); return v === null || v === undefined ? get.call(this, k) : String(v); }, () => get.call(this, k));
    };
    P.setItem = function (k, v) {
      if (!ours(this, k)) return set.call(this, k, v);
      via(() => sdk.data.setItem(k, String(v)), () => set.call(this, k, v));
    };
    P.removeItem = function (k) {
      if (!ours(this, k)) return del.call(this, k);
      via(() => sdk.data.removeItem(k), () => del.call(this, k));
    };
  }

  // Called by the game (from the hook the build adds) once the game has set itself up.
  window.__capyHook = (g) => {
    call(s => s.game.loadingStop());
    const PLAYING = ['play', 'intro', 'bossdeath'];
    let was = g.state, playing = false, sdkMute = false, adBusy = false;

    const applySettings = (st) => { sdkMute = !!(st && st.muteAudio); };
    call(s => { applySettings(s.game.settings); s.game.addSettingsChangeListener(applySettings); });

    // midgame ad between runs: after a game over, when the player leaves the results screen
    function midgame(next) {
      if (!sdk || adBusy) return;
      let pausedForAd = false;
      const done = () => {
        adBusy = false;
        if (g.AC && g.AC.state === 'suspended') g.AC.resume().catch(() => {});
        if (pausedForAd && g.state === 'paused') g.pause(false);
      };
      adBusy = true;
      call(s => s.ad.requestAd('midgame', {
        adStarted: () => {
          if (next === 'play' && g.state === 'play') { g.pause(true); pausedForAd = true; }
          if (g.AC) g.AC.suspend().catch(() => {});
        },
        adFinished: done,
        adError: (e) => { log('ad not shown', e && e.code); done(); },
      }));
      if (!sdk) adBusy = false;
    }

    setInterval(() => {
      const now = g.state;
      if (sdkMute && !g.muted) g.muted = true; // the platform's mute wins over the in-game sound button
      const changed = now !== was;
      if (changed && was === 'over') midgame(now); // the ad goes before the next run is reported
      if (changed && now === 'bossdeath') call(s => s.game.happytime());
      was = now;
      if (adBusy) return; // no gameplay events while an ad is up; the run is reported once it ends
      const nowPlaying = PLAYING.includes(now);
      if (nowPlaying !== playing) { playing = nowPlaying; call(s => nowPlaying ? s.game.gameplayStart() : s.game.gameplayStop()); }
    }, 150);
  };

  function loadGame() {
    const s = document.createElement('script');
    s.src = 'game.js';
    document.body.appendChild(s);
  }

  async function boot() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        const S = window.CrazyGames.SDK;
        await Promise.race([S.init(), new Promise((_, no) => setTimeout(() => no(new Error('init timeout')), 5000))]);
        if (S.environment === 'crazygames' || S.environment === 'local') sdk = S;
        log('environment', S.environment);
      }
    } catch (e) { log('SDK unavailable, running without it', e && e.message); sdk = null; }
    if (sdk) { routeSaves(); call(s => s.game.loadingStart()); }
    loadGame();
  }
  boot();
})();
