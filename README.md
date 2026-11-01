# Capybara with a Gun

A browser survival auto-shooter. Ant monsters pour out of the ground and never stop; your capybara's gun fires by itself at the nearest one. Keep moving, grab the seeds to level up, pick a weapon path, and survive the bosses that turn up every two minutes.

Play it at https://petrieuk.co.uk/games/capybara-with-a-gun/. On a phone you can add it to your home screen and it works offline.

The whole game is one file, `index.html`, with all its art embedded. `fonts/` holds its two fonts (Lilita One and Rubik, under the SIL Open Font License), and `manifest.webmanifest`, `sw.js` and `icons/` only make the hosted version installable. Open it in a browser to play, or serve the folder:

```bash
python -m http.server 8000
```

## Controls

| | Keyboard | Phone | Controller |
|---|---|---|---|
| Move | WASD or arrow keys | Drag anywhere, or use the stick bottom-left | Left stick or d-pad |
| Airstrike | Space | Round button, bottom-right | A, RB or RT |
| Pause | P or Esc | Pause button | Start |
| Heat-vision cam | C | | |
| Sound | M | Sound button | |

## What's in it

- **Six weapon paths**, chosen at your first level-up: Gunner, Pistolier, Shotgunner, Sniper, Pyro and Bombardier, each with its own upgrades and an evolution (max one upgrade and take its matching general upgrade).
- **Eleven bosses** with intros and death animations. The Queen opens every lap and ANT-1000 closes it; in between, the Meadow has Big Chompy, Talon and Slithers, the Scorched Dunes have Scorch (scorpion), Grumble (sandworm) and Rollo (armadillo), and the Midnight Swamp has the Bog King (toad), Mama Skeeter (mosquito) and King Fungus. Their health scales with your build and they enrage at half health.
- **Elite ants** (splitter, shielded, speedy) that drop treasure chests with a free upgrade.
- **Map power-ups** (seed magnet, freeze bomb, rage chilli) and **hazards** (ant tunnels, sticky sap, swarm waves).
- **Easy, Normal and Nightmare** difficulty (Nightmare unlocks after a 10-minute run), plus a **daily challenge** with a fixed path and twist each day.
- **Wardrobe**: capybara skins with stat bonuses and hats, some unlocked by progress and achievements.
- **Sidekicks** from level 10: a drone buddy or a boomerang, levelled up separately from your gun.
- **New areas** after each lap of all five bosses: Scorched Dunes (sand, cacti, sandstone) and the night-time Midnight Swamp (moss, pools, glowing mushrooms), with tougher, faster swarms.
- **Shop**: coins earned every run buy permanent upgrades (health, damage, speed, pickup range, XP, airstrike charge).
- **Run summary** after each death (what killed you, boss times, damage by source, your build) and a build view on the pause screen.
- **Settings** for music and sound volume, screen shake, flashes, damage numbers and a low-graphics mode.
- First-run tips, and a **Report a bug** button that fills in your run details (as an email on petrieuk.co.uk, or a GitHub issue on the test build).
- Music, hit-stop, screen shake, phone and controller support.

Progress, best runs and cosmetics are saved in the browser's local storage.

Art made with Pixa.

## Copyright

Copyright © 2026 Steven Petrie, trading as PetrieUK. All rights reserved.

The source is public so the game can be hosted, not so it can be reused. You may not copy, modify, redistribute, rehost or sell the game or any part of it, including the art, without written permission. See [LICENSE](LICENSE). The fonts in `fonts/` keep their own open licences.
