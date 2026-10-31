# Capybara with a Gun

A browser survival auto-shooter. Ant monsters pour out of the ground and never stop; your capybara's gun fires by itself at the nearest one. Keep moving, grab the seeds to level up, pick a weapon path, and survive the bosses that turn up every two minutes.

The whole game is one file, `index.html`, with all its art embedded. Open it in a browser to play, or serve the folder:

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
- **Five bosses** with intros and death animations: Queen Antoinette, Big Chompy, Talon, Slithers and ANT-1000. Their health scales with your build and they enrage at half health.
- **Elite ants** (splitter, shielded, speedy) that drop treasure chests with a free upgrade.
- **Map power-ups** (seed magnet, freeze bomb, rage chilli) and **hazards** (ant tunnels, sticky sap, swarm waves).
- **Easy, Normal and Nightmare** difficulty (Nightmare unlocks after a 10-minute run), plus a **daily challenge** with a fixed path and twist each day.
- **Wardrobe**: capybara skins with stat bonuses and hats, some unlocked by progress and achievements.
- Music, hit-stop, screen shake, phone and controller support.

Progress, best runs and cosmetics are saved in the browser's local storage.

Art made with Pixa.
