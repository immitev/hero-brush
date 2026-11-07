/**
 * Mutable per-frame session state shared between the session runner (rAF loop)
 * and the R3F scene. Deliberately NOT in React state: it changes every frame.
 */
import type { BrushPose } from './choreo';
import type { Vec3 } from './mouth';
import { type PlaqueState, createPlaque } from './plaque';
import type { Motion } from './segments';

export type Phase = 'idle' | 'countdown' | 'playing' | 'victory';

export type HeroState = 'idle' | 'travel' | 'brush';

export interface HeroSim {
  /** Feet position. */
  pos: Vec3;
  /** Unit horizontal facing direction. */
  facing: Vec3;
  state: HeroState;
  /** Speed of the last move, for travel animations. */
  speed: number;
}

export type FxEvent =
  | { type: 'stroke'; pos: Vec3; motion: Motion }
  | { type: 'toothClean'; pos: Vec3 }
  | { type: 'segmentDone'; segment: number }
  | { type: 'allClean' };

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
  segmentIndex: number;
  segmentProgress: number;
  stopIndex: number;
  brush: BrushPose;
  hero: HeroSim;
  plaque: PlaqueState;
  /** Overall cleanliness 0..1. */
  clean: number;
  /** Count of tooth surfaces finished. */
  surfacesDone: number;
  events: FxEvent[];
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
    segmentIndex: 0,
    segmentProgress: 0,
    stopIndex: 0,
    brush: { pos: [0, -0.2, 4.2], bristle: [0, -1, 0], axis: [1, 0, 0], contact: false, cycle: 0, motion: 'circles' },
    hero: { pos: [0, -1.2, 4.5], facing: [0, 0, 1], state: 'idle', speed: 0 },
    plaque: createPlaque(),
    clean: 0,
    surfacesDone: 0,
    events: [],
    aspect: 0.5625,
    camPos: [0, 0, 9],
  };
}

/** Single shared instance. */
export const runtime: Runtime = createRuntime();

export function resetRuntime(rt: Runtime = runtime): void {
  Object.assign(rt, createRuntime());
}
