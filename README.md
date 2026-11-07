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
npm run build      # generates missing voice lines, type-checks, then builds dist/ with the service worker
npm run voices     # (re)generates the neural TTS voice lines in public/voice/ (needs an Azure key)
npm run preview    # serves dist/ (use this to test offline / install behaviour)
npm test           # vitest unit tests (game logic, i18n tables, voice data, voice generator helpers)
npm run typecheck  # tsc --noEmit
npm run icons      # regenerates public/icons/*.png from scripts/gen-icons.mjs
```

Audio only starts after the big **GO!** tap (browser autoplay rules, especially iOS). Music and
sound effects are synthesised with Web Audio; voice lines are MP3s generated at build time (below)
and played through the same Web Audio graph. Any line without a file falls back to the device's
speech synthesis in the selected language.

### Languages and voices

The whole UI and every voice line exist in **English** and **Bulgarian** (`src/i18n/en.ts`,
`src/i18n/bg.ts`; `bg` must have exactly the same keys). The language defaults to the browser
language (`bg*` → Bulgarian) and can be switched with the EN/БГ toggle on the hub or in the parent
area; it is saved with the other settings.

Each speaker has its own voice: the narrator (zone prompts, countdown, praise) and every hero
(hero-select line, scrubbing quips, boss and victory lines). Texts live in `src/voice/lines.json`,
voices and prosody in `src/voice/voices.json`; both the game and the generator read these files.

`npm run voices` (also run by `npm run build`) calls Azure Speech neural TTS for every line whose
SSML changed or whose file is missing and writes `public/voice/<lang>/<speaker>/<line>.mp3` plus
`public/voice/manifest.json`. The generated files are committed, so builds work without a key.
Key lookup: `AZURE_SPEECH_KEY`, else the file named by `AZURE_SPEECH_KEY_FILE`, else
`~/.pygmy-speech-key`; region `AZURE_SPEECH_REGION` (default `eastus`). Requests are throttled to
the free tier's 20 per minute. Without a key the script only warns about missing lines.

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
- **Mouth City arena**: cute pastel cartoon mouth with 24 rounded teeth whose shader goes from
  lightly yellow-tinted with a few soft plaque spots to bright, glossy, sparkling white as each
  zone is brushed; soft pink gums, friendly tongue, lips, gradient backdrop, camera rig that
  moves per zone, toon shading, bloom, particle bursts and foam bubbles.
- **Heroes**: every hero carries a big cartoon toothbrush (handle in hero colours, mint bristles,
  striped toothpaste), travels to the monster on the current zone's teeth and scrubs it on the
  beat with a fast back-and-forth motion until it is foamed, squeezed and pops into sparkles.
  Iron Man jets over with thruster flames, Spider-Man swings in on a web line, Batman glides in
  with his cape.
- **Boss**: the Cavity King for the last 20 seconds; the hero scrubs it and it shrinks under
  foam until it bursts at 0:00.
- **Audio**: procedural 2-minute synth track at 120 bpm with a boss build-up, procedural SFX
  (brushing "shh-shh" strokes, squeaky-clean, pops, boss roar, fanfare), speech-synthesis voice
  lines with a distinct neural voice per hero and a narrator, in English and Bulgarian.
- **Progression**: 0-3 stars per session (30 s = 1, full session = 2, morning + evening = 3),
  day streak, session history in IndexedDB (Dexie), suit unlocks. Only the best session per
  day and slot (morning/evening, taken from the session's start time) counts towards totals and
  unlocks, so repeating a session does not farm stars.
- **Parent area** behind a press-and-hold (3 s) + arithmetic gate (new question after every
  miss, 60 s lockout after three misses): summary, history table, language, music/SFX/voice volume, voice mute,
  graphics quality (low/high), delete all data.
- **PWA**: manifest, generated icons (incl. maskable), Workbox precache of all assets for offline
  play, in-app "new version" prompt.
- **Performance**: quality tier (low disables post-processing and reduces particles), dynamic
  resolution via drei's `PerformanceMonitor`, automatic fallback to low quality on slow devices.

## Layout

```
src/
  app/        App shell, screens (Hub, HeroSelect, Play, Parent), HUD components, styles
  game/       pure game logic: clock, zones, scoring, mouth layout, simulation, zustand store
  scene/      React Three Fiber scene: Arena, heroes (with toothbrush), monsters, boss, particles
  heroes/     data-driven hero packs (<id>/hero.ts)
  audio/      Web Audio engine, procedural music sequencer, SFX, voice-line player
  voice/      voice line texts (en + bg) and per-speaker voice config, shared with the generator
  i18n/       UI strings (en, bg), useT() hook
  storage/    Dexie database (sessions + settings)
  pwa/        wake lock, install prompt
public/icons/ generated PWA icons
public/voice/ generated voice lines (MP3) + manifest
scripts/      icon generator, voice generator
```
