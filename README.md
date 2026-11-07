# Hero Brush

A 3D superhero toothbrushing game for kids that runs in the browser and installs as a PWA.
Pick a hero, then brush along for two minutes while the hero demonstrates the correct technique
(45° to the gum, small circles, vertical flicks behind the front teeth, flat on the chewing
surfaces, tongue last) on a giant set of teeth whose plaque clears exactly where the brush goes.

Status: **playable MVP** — a two-minute brushing lesson with a superhero coach. (Milestones
M0-M6 of [PLAN.md](PLAN.md), with the monster/boss gameplay replaced by technique teaching;
no brush detection, sticker book, profiles or push reminders yet.)

Play it: **https://immitev.github.io/hero-brush/** (in Bulgarian, as «Супер Четка»).

The public build is Bulgarian-only (`ENABLED_LANGS` in `src/i18n/lang.ts`; the English texts and
voices are kept in the repo) and its heroes are the original characters Железарко, Паячко and
Прилепчо. Everything is procedurally generated: no official art, logos or models are used. Pushing
to `main` deploys to GitHub Pages via `.github/workflows/pages.yml`.

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

- **Hub** with GO button, star total, streak counter, install button (Chrome/Android), language
  switch and the parent link.
- **Hero select**: 3D carousel of three procedurally built chibi heroes, each with two suits
  (the second unlocks after 6 stars earned with that hero).
- **The brushing lesson (2:00)**: one scene, no monsters. The hero holds a realistic toothbrush
  (rectangular head with bristle tufts, angled neck, pea of striped paste) and demonstrates the
  modified Bass technique on a giant, anatomically shaped set of teeth, segment by segment:
  - outer surfaces (4 × 15 s, top/bottom × left/right): bristles at **45° to the gumline**, small
    gentle circles over two teeth at a time, drifting along the row, finishing each spot with a
    sweep away from the gum;
  - inner surfaces of the back teeth (2 × 10 s): the same 45° circles;
  - inner surfaces of the front teeth (2 × 8 s): brush held **vertically**, flicks away from the
    gum (down for the top teeth, up for the bottom);
  - chewing surfaces (15 s): brush **flat**, short back-and-forth scrubs, bottom row then top;
  - tongue (9 s): gentle strokes from back to front.
  A thin yellowish plaque film covers every tooth surface (8 × 4 cells per surface) and clears
  exactly where the brush head passes; the gumline band only clears when the bristles are
  angled towards the gum. Foam trickles from the bristles and a sparkle marks each finished
  surface. The HUD shows the segment, a mini mouth map, an animated motion icon with a short
  instruction (EN/BG), the clock and a "teeth cleaned" bar.
- **Mirror convention**: the mouth on screen is the child's own mouth as seen in a mirror, so
  "left" in every prompt and on the mouth map is the child's left (screen left). The hero is a
  coach facing the child, so its right hand appears on the child's left; what matters is the
  brush path, which is always shown from the child's point of view.
- **Voice**: the narrator coaches each segment (technique cues, "gentle pressure", "spit, don't
  rinse"), heroes drop short technique quips; all lines are neural TTS generated at build time
  (`npm run voices`, EN + BG), with speech-synthesis fallback.
- **Camera**: a per-stop camera pose keeps the brush head large and the angle readable
  (outside from the cheek side, inside the arch for the inner surfaces, above/below for the
  chewing surfaces); the choreography tests prove head and hero are on screen at desktop and
  375×812.
- **Progression**: 0-3 stars per session (30 s = 1, full session = 2, morning + evening = 3),
  day streak, session history in IndexedDB (Dexie), suit unlocks. Only the best session per
  day and slot (morning/evening, taken from the session's start time) counts towards totals and
  unlocks, so repeating a session does not farm stars.
- **Parent area** behind a press-and-hold (3 s) + arithmetic gate (new question after every
  miss, 60 s lockout after three misses): summary, history table, language, music/SFX/voice
  volume, voice mute, graphics quality (low/high), delete all data.
- **PWA**: manifest, generated icons (incl. maskable), Workbox precache of all assets for offline
  play, in-app "new version" prompt.
- **Performance**: quality tier (low disables post-processing and clearcoat, fewer particles
  and tooth segments), dynamic resolution via drei's `PerformanceMonitor`, automatic fallback
  to low quality on slow devices.

## Layout

```
src/
  app/        App shell, screens (Hub, HeroSelect, Play, Parent), HUD components, styles
  game/       pure game logic: clock, segments, choreography (brush poses), plaque cells, scoring,
              mouth layout, simulation, zustand store
  scene/      React Three Fiber scene: Arena (teeth, gums, tongue), Brush, heroes, particles
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
