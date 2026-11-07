# Hero Brush — Game Plan

A browser-based, installable (PWA) toothbrushing game for kids. Inspired by the idea behind the
Aquafresh Brush Time app (pick a character, brush along to a 2‑minute song with a countdown), but
pushed much further: real‑time 3D, a superhero fighting "plaque monsters" in the zone of the mouth
the child should be brushing right now, and rewards that make kids want to come back twice a day.

> **IP note.** Iron Man and Spider‑Man are Marvel/Disney trademarks and Batman is a DC/Warner Bros.
> trademark. Using them is fine for a **private family build** (private repo, not deployed publicly,
> not distributed). Before any public release, swap them for original heroes — the architecture
> below treats each hero as a data‑driven "hero pack" so that swap is a config + asset change, not
> a rewrite. Do not commit official logos, film/comic art, or ripped game models; all 3D models
> should be our own stylised creations.

---

## 1. What the reference app does (baseline to beat)

| Aquafresh Brush Time | Hero Brush |
|---|---|
| Pick 1 of 4 characters | Pick 1 of 3 heroes, each with unlockable suits |
| 12 two‑minute songs | Adaptive music tracks + hero sound effects |
| Choose a colour backdrop | Full 3D animated "mouth city" arena |
| 2‑minute countdown | 2‑minute countdown split into 6 guided zones |
| No rewards / tracking | Stars, streaks, unlocks, sticker book, parent view |
| iOS app | PWA: any phone/tablet browser, installable, offline |

## 2. Core gameplay loop

1. **Pick your hero** (3D carousel, hero does an idle pose / taunt).
2. **Brush session — 2:00**, divided into 6 zones of 20 s:
   - Top‑left outside → top‑right outside → bottom‑left outside → bottom‑right outside →
     top insides & chewing surfaces → bottom insides & chewing surfaces.
   - A 3D mouth map in the corner highlights the current zone; a voice line + arrow cue the switch.
   - In the main view, plaque monsters ("Gunkoids") pop out of the teeth in that zone. The hero
     auto‑attacks them on a rhythm synced to the music; the child's job is just to keep brushing.
   - Optional **brush detection** (see §6) makes attacks land only while the child is actually
     brushing — big motivator, but the game must work fully without it.
3. **Boss at 1:40** — a bigger "Cavity King" appears for the last 20 s; defeated exactly at 0:00.
4. **Victory screen** — sparkly clean teeth, stars awarded, streak updated, chance of an unlock.
5. **Spit & rinse** reminder, then back to the hub.

Session length is fixed at 2 minutes (dentist recommendation). No in‑session fail state — kids
always win; reward quantity scales with completion (stopping early = fewer stars).

## 3. Heroes (hero packs)

Each hero is one folder of data + assets: `src/heroes/<id>/hero.json`, `model.glb`, `sfx/*`, `vo/*`.

| Hero | Attack style | Movement | Signature finisher | Unlockable suits (examples) |
|---|---|---|---|---|
| Iron Man | Repulsor blasts (glowing beams, bloom) | Hovers & jets between teeth | Unibeam sweep across a whole row | Classic red/gold, stealth black, arctic white |
| Spider‑Man | Web shots that wrap monsters into cocoons | Swings from tooth to tooth, wall‑crawls | Web net yanks all monsters off at once | Classic, black suit, "toothpaste mint" |
| Batman | Batarangs (arcing projectiles), gadget grapples | Glides with cape, grapples | Smoke bomb + combo takedown | Grey/black, blue/grey classic, "bubblegum" |

`hero.json` defines: display name, colour palette, model path, animation clip names (idle, run,
attack, special, celebrate), projectile type, VO lines per event, suit variants (material swaps).

## 4. Visual direction — "nice 3D"

- **Engine:** Three.js via **React Three Fiber** + `@react-three/drei` + `@react-three/postprocessing`.
- **Style:** stylised toon / cel‑shaded (chunky proportions, big heads — reads well small, easier to
  model, avoids looking like official likenesses). Outline pass + soft rim light.
- **Arena:** a giant, friendly cartoon mouth ("Mouth City") — glossy teeth with subsurface‑ish
  shading, gums as a soft floor, camera dollies between zones. Teeth visibly go from yellow‑grimy
  to sparkling white as each zone is cleaned (shader `cleanliness` uniform 0→1).
- **Effects:** bloom on repulsors/sparkles, GPU particle bursts (foam bubbles, monster "poof"),
  screen‑shake on boss hits (subtle, toggleable), toothpaste‑foam trail particles.
- **Assets:** modelled & rigged in Blender, animated with Mixamo‑style clips retargeted to our rig,
  exported as glTF 2.0 with **Draco** mesh + **KTX2/Basis** texture compression. Target ≤ 1.5 MB
  per hero, ≤ 6 MB total initial download.
- **Performance budget:** 60 fps on a 2021 mid‑range Android, ≤ 150 draw calls, ≤ 300k tris on
  screen, dynamic resolution scaling (`PerformanceMonitor` in drei) and a "low" quality tier that
  disables post‑processing.

## 5. Audio

- 3–5 original 2‑minute tracks (royalty‑free / commissioned), each with cue markers every 20 s for
  zone changes and a build‑up at 1:40 for the boss.
- Web Audio API (via Howler.js) for low‑latency SFX; music drives the attack rhythm (beat map JSON).
- Recorded or TTS voice prompts: "Top left, outside!", "Great job!", "Switch sides!".
- Respect the mute switch and provide separate music / SFX / voice volume.

## 6. Brush detection (stretch, opt‑in)

- **Camera mode:** MediaPipe Face Landmarker (WASM, runs on‑device) detects mouth + hand/brush
  motion near the mouth; estimate which side is being brushed from hand position. All processing
  local — no frames ever leave the device. Off by default; parent must enable.
- **Mic mode (simpler):** detect brushing noise energy band — "is brushing happening?" only.
- **Fallback:** tap‑to‑attack button for kids who want to interact; or fully passive.

## 7. Progression & rewards

- **Stars** per session (0–3: completed, brushed all zones, morning+evening same day).
- **Streak calendar** with morning/evening slots; streak flame grows with consecutive days.
- **Unlocks:** suits, new monster types, new arena themes (night city, space, underwater), music.
- **Sticker book:** each defeated monster type becomes a collectible card.
- **No ads, no purchases, no external links in the kid area.**

## 8. Parent area

- Gate: simple "hold for 3 s + answer 7 × 4" style gate.
- Brushing history (chart), streaks, per‑zone coverage if detection is on.
- Reminders: Web Push notifications at chosen times (PWA, where supported; iOS 16.4+ when installed).
- Multiple child profiles on one device.
- Settings: quality tier, camera/mic opt‑in, volumes, session length override (dentist advice).
- Export/delete all data.

## 9. Tech architecture

```
Vite + TypeScript + React 19
├─ React Three Fiber scene graph   (3D: arena, heroes, monsters, FX)
├─ Zustand game store              (session state machine, timers, score)
├─ XState (or hand‑rolled FSM)     (hub → select → countdown → zones → boss → victory)
├─ Howler.js                       (music + SFX, beat map)
├─ Dexie (IndexedDB)               (profiles, history, unlocks — local only)
├─ vite-plugin-pwa (Workbox)       (manifest, precache, offline, update prompt)
└─ Vitest + Playwright             (logic tests + smoke e2e incl. offline)
```

- **Timer correctness:** game clock uses `performance.now()` deltas, survives tab throttling;
  Wake Lock API keeps screen on during the session.
- **Offline first:** all assets precached after first load; app fully playable in airplane mode.
- **Privacy:** no accounts, no backend, no analytics by default — everything in IndexedDB.
  (Optional later: sync via a tiny backend if multiple devices are needed.)
- **Install UX:** custom "Add to Home Screen" prompt for Android/Chrome; iOS instructions sheet.
- **Orientation:** portrait‑first (phone propped on the sink), landscape supported on tablets.
- **Hosting:** GitHub Pages or Cloudflare Pages *only* once heroes are original; for the private
  family build, run locally or behind access control (e.g. Cloudflare Access).

### Folder layout

```
src/
  app/            routing, screens (Hub, HeroSelect, Session, Victory, Parent)
  game/           state machine, clock, zones, scoring, beat sync
  scene/          R3F components: Arena, Teeth, Hero, Monster, FX, CameraRig
  heroes/         <hero-id>/hero.json + assets (one folder per hero pack)
  audio/          music, sfx, beatmaps
  detection/      camera + mic brushing detection (lazy‑loaded)
  storage/        Dexie schema, profiles, history
  pwa/            service worker hooks, install prompt, notifications
public/
  icons/ manifest assets
```

## 10. Milestones

| # | Milestone | Outcome |
|---|---|---|
| M0 | Scaffold | Vite + R3F + PWA manifest/SW, CI (lint, test, build), deploy preview |
| M1 | Timer prototype | 2‑min session FSM with 6 zones, mouth‑map UI, voice cues, wake lock — playable with placeholder cubes |
| M2 | Arena & teeth | Mouth City scene, cleanliness shader, camera rig moving per zone |
| M3 | First hero | One hero fully rigged & animated, attacks, monsters spawn/die, boss, victory |
| M4 | All heroes | Remaining two hero packs, hero‑select carousel |
| M5 | Audio | Music tracks with beat maps, SFX, VO |
| M6 | Progression | Stars, streaks, unlocks, sticker book, profiles (IndexedDB) |
| M7 | Parent area | Gate, history chart, reminders/notifications, settings |
| M8 | Polish & perf | Quality tiers, dynamic res, asset compression, Lighthouse PWA ≥ 95, device testing |
| M9 | Stretch | Camera/mic brush detection, extra arenas, seasonal events |

## 11. Risks

- **IP** — named heroes block any public release; mitigated by hero‑pack design (see note at top).
- **Low‑end phone performance** — mitigated by quality tiers and strict asset budgets.
- **iOS PWA limits** — push only when installed (16.4+), audio needs a user gesture to start;
  start session from a big "GO!" button.
- **Kids' privacy** — no data collection; camera processing on‑device and opt‑in only.
- **3D asset cost** — biggest effort item; start with one hero end‑to‑end before the other two.
