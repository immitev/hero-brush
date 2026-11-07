import type { NarratorLine } from '../voice/lines';

export const ZONE_SECONDS = 20;
export const ZONE_COUNT = 6;
export const SESSION_SECONDS = ZONE_SECONDS * ZONE_COUNT; // 120
export const BOSS_SECONDS = 20;
export const BOSS_START = SESSION_SECONDS - BOSS_SECONDS; // 100

export type Row = 'upper' | 'lower';
export type Side = 'left' | 'right' | 'both';
export type Surface = 'outside' | 'inside';

export interface Zone {
  index: number;
  id: string;
  /** Narrator line (src/voice/lines.json); the HUD label is the i18n key `zone.<id>`. */
  voice: NarratorLine;
  row: Row;
  side: Side;
  surface: Surface;
}

/** Order from PLAN.md §2. */
export const ZONES: readonly Zone[] = [
  { index: 0, id: 'upper-left-out', voice: 'zone0', row: 'upper', side: 'left', surface: 'outside' },
  { index: 1, id: 'upper-right-out', voice: 'zone1', row: 'upper', side: 'right', surface: 'outside' },
  { index: 2, id: 'lower-left-out', voice: 'zone2', row: 'lower', side: 'left', surface: 'outside' },
  { index: 3, id: 'lower-right-out', voice: 'zone3', row: 'lower', side: 'right', surface: 'outside' },
  { index: 4, id: 'upper-in', voice: 'zone4', row: 'upper', side: 'both', surface: 'inside' },
  { index: 5, id: 'lower-in', voice: 'zone5', row: 'lower', side: 'both', surface: 'inside' },
];

export function clampElapsed(elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(elapsed, SESSION_SECONDS);
}

/** Index of the zone active at `elapsed` seconds (0..5). */
export function zoneIndexAt(elapsed: number): number {
  const e = clampElapsed(elapsed);
  return Math.min(ZONE_COUNT - 1, Math.floor(e / ZONE_SECONDS));
}

export function zoneAt(elapsed: number): Zone {
  return ZONES[zoneIndexAt(elapsed)];
}

/** Progress 0..1 through the given zone at `elapsed`. */
export function zoneProgress(elapsed: number, zoneIndex: number): number {
  const start = zoneIndex * ZONE_SECONDS;
  const p = (clampElapsed(elapsed) - start) / ZONE_SECONDS;
  return Math.max(0, Math.min(1, p));
}

/** Cleanliness 0..1 of each zone at `elapsed`. */
export function zoneCleanliness(elapsed: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < ZONE_COUNT; i++) out.push(zoneProgress(elapsed, i));
  return out;
}

export function isBossActive(elapsed: number): boolean {
  return elapsed >= BOSS_START && elapsed < SESSION_SECONDS;
}

/** 0 when the boss appears, 1 when it is defeated (at 0:00). */
export function bossProgress(elapsed: number): number {
  const p = (clampElapsed(elapsed) - BOSS_START) / BOSS_SECONDS;
  return Math.max(0, Math.min(1, p));
}

export function timeLeft(elapsed: number): number {
  return Math.max(0, SESSION_SECONDS - clampElapsed(elapsed));
}

export function sessionProgress(elapsed: number): number {
  return clampElapsed(elapsed) / SESSION_SECONDS;
}

export function isSessionComplete(elapsed: number): boolean {
  return elapsed >= SESSION_SECONDS;
}

/** Formats seconds as m:ss (ceil so the display hits 0:00 exactly at the end). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds - 1e-6));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}
