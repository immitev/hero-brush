/**
 * Mutable per-frame session state shared between the session runner (rAF loop)
 * and the R3F scene. Deliberately NOT in React state: it changes every frame.
 */
import type { Vec3 } from './mouth';
import { ZONE_COUNT } from './zones';

export type Phase = 'idle' | 'countdown' | 'playing' | 'victory';

/** rising → alive → foamed (scrubbed, covered in foam, squeezing) → dying (pop) */
export type MonsterState = 'rising' | 'alive' | 'foamed' | 'dying';

export interface Monster {
  id: number;
  toothIndex: number;
  pos: Vec3;
  normal: Vec3;
  state: MonsterState;
  /** Game time when the current state began. */
  stateAt: number;
  bornAt: number;
  seed: number;
  /** Foam coverage 0..1 built up by scrubbing. */
  foam: number;
}

export type HeroState = 'idle' | 'travel' | 'scrub';

export interface HeroSim {
  pos: Vec3;
  /** Unit horizontal facing direction. */
  facing: Vec3;
  state: HeroState;
  /** Monster id being scrubbed, -1 for the boss, 0 for none. */
  targetId: number;
  /** Point the brush aims at (monster / boss surface). */
  aim: Vec3 | null;
  scrubStartedAt: number;
  /** Index of the last scrub stroke (8th notes). */
  lastStroke: number;
  /** Speed of the last move, for travel animations. */
  speed: number;
  /** Which side of the current target the hero approaches from (+1 / -1), and for which monster. */
  standoffSide: 1 | -1;
  standoffFor: number;
}

export type FxEvent =
  | { type: 'pop'; pos: Vec3; color: string; count?: number }
  | { type: 'scrub'; pos: Vec3; normal: Vec3 }
  | { type: 'foamed'; pos: Vec3 }
  | { type: 'bossFoam'; pos: Vec3 }
  | { type: 'bossHit'; pos: Vec3 }
  | { type: 'bossDefeated'; pos: Vec3 }
  | { type: 'zoneClean'; zoneIndex: number }
  | { type: 'sparkle'; pos: Vec3 };

export interface Runtime {
  phase: Phase;
  paused: boolean;
  /** Game seconds since the session started (0..120). */
  elapsed: number;
  /** Game time of the previous simulation step. */
  lastSimT: number;
  /** Seconds since countdown started (phase 'countdown'). */
  countdownT: number;
  /** Seconds since victory started. */
  victoryT: number;
  zoneIndex: number;
  zoneProgress: number;
  zoneClean: number[];
  bossActive: boolean;
  /** 1 = full health, 0 = defeated. */
  bossHealth: number;
  bossPos: Vec3;
  bossHitAt: number;
  /** Foam coverage on the boss 0..1. */
  bossFoam: number;
  monsters: Monster[];
  hero: HeroSim;
  events: FxEvent[];
  nextId: number;
  lastSpawnAt: number;
  nextSpawnIn: number;
  /** Camera shake intensity 0..1 (decays). */
  shake: number;
  kills: number;
  /** Viewport aspect ratio (width / height), written by the scene. */
  aspect: number;
  /** Current camera position, written by the scene. */
  camPos: Vec3;
}

export function createRuntime(): Runtime {
  return {
    phase: 'idle',
    paused: false,
    elapsed: 0,
    lastSimT: 0,
    countdownT: 0,
    victoryT: 0,
    zoneIndex: 0,
    zoneProgress: 0,
    zoneClean: new Array(ZONE_COUNT).fill(0),
    bossActive: false,
    bossHealth: 1,
    bossPos: [0.45, 0.1, 3.2],
    bossHitAt: -10,
    bossFoam: 0,
    monsters: [],
    hero: {
      pos: [0, -0.3, 4.5],
      facing: [0, 0, 1],
      state: 'idle',
      targetId: 0,
      aim: null,
      scrubStartedAt: -10,
      lastStroke: -1,
      speed: 0,
      standoffSide: 1,
      standoffFor: 0,
    },
    events: [],
    nextId: 1,
    lastSpawnAt: -10,
    nextSpawnIn: 0.6,
    shake: 0,
    kills: 0,
    aspect: 0.5625,
    camPos: [0, 0.4, 9],
  };
}

/** Single shared instance. */
export const runtime: Runtime = createRuntime();

export function resetRuntime(rt: Runtime = runtime): void {
  Object.assign(rt, createRuntime());
}
