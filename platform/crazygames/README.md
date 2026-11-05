# CrazyGames build

This is a separate build of Capybara with a Gun for CrazyGames. The game itself (`index.html` at the repo root) is not changed. The build copies it and applies the CrazyGames changes to the copy, so petrieuk.co.uk keeps serving the normal game.

```bash
node platform/crazygames/build.mjs
```

The output goes to `dist/crazygames/` (the files to play) and `dist/capybara-crazygames.zip` (the upload). `dist/` is not committed.

## What the build changes

- Loads the CrazyGames SDK v3, then `crazygames.js`, which starts the SDK before loading the game (`game.js`, which is the inline script split out).
- **Gameplay events:** `gameplayStart` when a run is in play (including boss intros and boss deaths). `gameplayStop` on pause, level-up picks, game over and the menu.
- **`happytime`** when a boss dies.
- **Midgame ad** when the player leaves the game-over screen. The game is paused and its audio suspended until the ad ends or fails.
- **CrazyGames mute setting** always wins over the in-game sound button.
- **Saves:** the `capy-*` keys go through the SDK data module, so progress follows a CrazyGames account. If the module is off, they fall back to `localStorage`. Turn on *Progress Save* in the submission form.
- **Removed:** the Buy Me a Coffee strip and the "Report a bug" links (GitHub). The share text points at the CrazyGames page; update `GAME_URL` in `build.mjs` once the slug is confirmed.

Each patch checks that it matched, so the build stops if a change to the game moves its target.

## Testing locally

Serve `dist/crazygames/` on `localhost` (preview `capybara-crazygames`, port 5260). Locally, the SDK runs in `local` mode: ads show a placeholder and the console logs every SDK call. Add `?muteAudio=true` to test the platform mute.

## Reverting

The CrazyGames version lives on the `crazygames` branch, in its own folder (`capybara-crazygames`, a git worktree). `main`, the `capybara-with-a-gun` folder and the site build are not touched. To drop it, delete the branch and the folder:

```bash
git worktree remove ../capybara-crazygames
```

```bash
git branch -D crazygames
```

## Store listing and covers

`store/` holds the draft listing text (`STORE-TEXT.md`) and the three covers CrazyGames asks for: 1920×1080, 800×1200 and 800×800. The covers are real gameplay frames. To make new ones:

1. Run `python platform/crazygames/covers/mkcovers.py` to build `dist/covers/covers.html`, a hooked copy of the game. The real game isn't touched.
2. Run `node platform/crazygames/covers/receive.mjs` to save the images to `dist/covers/out/`.
3. Serve `dist/covers` on port 5261 (preview `capybara-covers`). Open `covers.html?shape=landscape`, `portrait` or `square` (add `&zoom=1.2` to frame closer), then run `await COVERS.shot({ name: '...' })` in the console. Options pick the frame: `ants`, `maxBelow`, `minBelow`, `spanX`, `lift`, `minDist`, `tries`.
