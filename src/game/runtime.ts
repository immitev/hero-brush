/**
 * Mutable per-frame session state shared between the session runner (rAF loop)
 * and the R3F scene. Deliberately NOT in React state: it changes every frame.
 */
import type { AttackKind } from '../heroes/types';
import type { Vec3 } from './mouth';
import { ZONE_COUNT } from './zones';

export type Phase = 'idle' | 'countdown' | 'playing' | 'victory';

export type MonsterState = 'rising' | 'alive' | 'cocooned' | 'dying';

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
  /** Set when a projectile is already flying towards it. */
  targeted: boolean;
}

export interface Projectile {
  id: number;
  kind: AttackKind;
  from: Vec3;
  to: Vec3;
  bornAt: number;
  duration: number;
  /** Monster id or -1 for the boss. */
  targetId: number;
}

export type FxEvent =
  | { type: 'pop'; pos: Vec3; color: string; count?: number }
  | { type: 'hit'; pos: Vec3; color: string }
  | { type: 'bossHit'; pos: Vec3 }
  | { type: 'bossDefeated'; pos: Vec3 }
  | { type: 'zoneClean'; zoneIndex: number }
  | { type: 'sparkle'; pos: Vec3 };

export interface Runtime {
  phase: Phase;
  paused: boolean;
  /** Game seconds since the session started (0..120). */
  elapsed: number;
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
  bossHitAt: number;
  monsters: Monster[];
  projectiles: Projectile[];
  events: FxEvent[];
  nextId: number;
  lastSpawnAt: number;
  nextSpawnIn: number;
  lastAttackBeat: number;
  /** Game time of the hero's last attack (for the arm animation). */
  heroAttackAt: number;
  /** World position the hero is aiming at. */
  heroAim: Vec3 | null;
  /** Hero's current world position (written by the scene). */
  heroPos: Vec3;
  /** Hero's hand position (written by the scene, used as projectile origin). */
  heroHand: Vec3;
  /** Camera shake intensity 0..1 (decays). */
  shake: number;
  kills: number;
}

export function createRuntime(): Runtime {
  return {
    phase: 'idle',
    paused: false,
    elapsed: 0,
    countdownT: 0,
    victoryT: 0,
    zoneIndex: 0,
    zoneProgress: 0,
    zoneClean: new Array(ZONE_COUNT).fill(0),
    bossActive: false,
    bossHealth: 1,
    bossHitAt: -10,
    monsters: [],
    projectiles: [],
    events: [],
    nextId: 1,
    lastSpawnAt: -10,
    nextSpawnIn: 0.6,
    lastAttackBeat: -1,
    heroAttackAt: -10,
    heroAim: null,
    heroPos: [0, 0, 4],
    heroHand: [0, 1, 4],
    shake: 0,
    kills: 0,
  };
}

/** Single shared instance. */
export const runtime: Runtime = createRuntime();

export function resetRuntime(rt: Runtime = runtime): void {
  Object.assign(rt, createRuntime());
}
