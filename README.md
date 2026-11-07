# Hero Brush

A 3D superhero toothbrushing game for kids that runs in the browser and installs as a PWA.
Pick a hero, brush for two minutes, and watch your hero clear plaque monsters out of each part of
the mouth while you brush it. The Cavity King shows up for the last 20 seconds and is always
defeated exactly at 0:00.

Status: **playable MVP** (milestones M0-M6 of [PLAN.md](PLAN.md), minus brush detection,
sticker book, profiles and push reminders).

Private family project. The hero characters belong to their trademark owners and must be replaced
with original heroes before any public release. Everything in this repo is procedurally generated:
no official art, logos or models are used.

## Run it

Requires Node 20+ (developed on Node 24 / npm 11).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then builds dist/ with the service worker and manifest
npm run preview    # serves dist/ (use this to test offline / install behaviour)
npm test           # vitest unit tests (clock, zones, scoring, mouth layout, simulation)
npm run typecheck  # tsc --noEmit
npm run icons      # regenerates public/icons/*.png from scripts/gen-icons.mjs
```

Audio only starts after the big **GO!** tap (browser autoplay rules, especially iOS). Voice prompts
use the device's built-in speech synthesis; music and sound effects are synthesised with Web Audio,
so there are no audio files to download.

### Dev shortcut: fast sessions

Add `?fast=1` to the URL to run the game clock at 10x (a full session takes 12 seconds), e.g.
`http://localhost:5173/?fast=1`. `?fast=20` runs at 20x, etc. Music still plays at normal speed.

## What is in the box

- **Hub** with GO button, star total, streak counter, install button (Chrome/Android) and the
  parent link.
- **Hero select**: 3D carousel of three procedurally built chibi heroes, each with two suits
  (the second unlocks after 6 stars earned with that hero).
- **Session**: 2:00 split into six 20-second zones in the order from PLAN.md, mini mouth map,
  big countdown, spoken zone prompts, screen wake lock, pause (automatic when the tab is hidden),
  early quit with fewer stars.
- **Mouth City arena**: cartoon mouth with 24 teeth whose shader goes from grimy yellow to
  sparkling white as each zone is brushed, gums, tongue, lips, camera rig that moves per zone,
  toon shading, bloom, particle bursts and foam bubbles.
- **Heroes**: Iron Man (repulsor beams, hovers), Spider-Man (web shots that cocoon monsters,
  swings), Batman (arcing batarangs, glides with cape). Attacks fire on the beat and auto-target
  monsters on the current zone's teeth.
- **Boss**: the Cavity King for the last 20 seconds; health drains with the clock.
- **Audio**: procedural 2-minute synth track at 120 bpm with a boss build-up, procedural SFX,
  speech-synthesis voice lines per hero.
- **Progression**: 0-3 stars per session (30 s = 1, full session = 2, morning + evening = 3),
  day streak, session history in IndexedDB (Dexie), suit unlocks.
- **Parent area** behind a multiplication gate: summary, history table, music/SFX volume, voice
  mute, graphics quality (low/high), delete all data.
- **PWA**: manifest, generated icons (incl. maskable), Workbox precache of all assets for offline
  play, in-app "new version" prompt.
- **Performance**: quality tier (low disables post-processing and reduces particles), dynamic
  resolution via drei's `PerformanceMonitor`, automatic fallback to low quality on slow devices.

## Layout

```
src/
  app/        App shell, screens (Hub, HeroSelect, Play, Parent), HUD components, styles
  game/       pure game logic: clock, zones, scoring, mouth layout, simulation, zustand store
  scene/      React Three Fiber scene: Arena, heroes, monsters, boss, projectiles, particles
  heroes/     data-driven hero packs (<id>/hero.ts)
  audio/      Web Audio engine, procedural music sequencer, SFX, speech voice
  storage/    Dexie database (sessions + settings)
  pwa/        wake lock, install prompt
public/icons/ generated PWA icons
scripts/      icon generator
```
