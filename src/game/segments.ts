/**
 * The two-minute brushing routine (modified Bass technique, NHS / ADA / EFP
 * guidance for 7–10 year olds), split into timed segments. Every tooth
 * surface gets the right motion:
 *  - outer surfaces: bristles at 45° to the gumline, small gentle circles,
 *    2–3 teeth at a time, finishing with a sweep away from the gum;
 *  - inner surfaces of back teeth: same 45° circles;
 *  - inner surfaces of front teeth: brush held vertically, flicks away from the gum;
 *  - chewing surfaces: brush flat, short back-and-forth scrubs;
 *  - tongue: gentle strokes from back to front.
 *
 * "Left" / "right" follow the mirror convention: the on-screen mouth is the
 * child's own mouth as seen in a mirror, so screen-left is the child's left.
 */
import type { NarratorLine } from '../voice/lines';

export type Motion = 'circles' | 'flick' | 'scrub' | 'tongue';
export type Row = 'upper' | 'lower' | 'both';
export type Side = 'left' | 'right' | 'both';
export type Surface = 'outer' | 'inner' | 'chewing' | 'tongue';

export interface Segment {
  index: number;
  id: string;
  /** Start time in session seconds. */
  start: number;
  seconds: number;
  row: Row;
  side: Side;
  surface: Surface;
  /** Tooth columns (0 = back left … 11 = back right) covered; empty for the tongue. */
  cols: readonly number[];
  motion: Motion;
  /** Narrator coaching line (src/voice/lines.json); the HUD label is the i18n key `seg.<id>`. */
  voice: NarratorLine;
}

const LEFT = [0, 1, 2, 3, 4, 5] as const;
const RIGHT = [6, 7, 8, 9, 10, 11] as const;
const BACK = [0, 1, 2, 3, 8, 9, 10, 11] as const;
const FRONT = [4, 5, 6, 7] as const;
const ALL = [...LEFT, ...RIGHT] as const;

type SegmentSpec = Omit<Segment, 'index' | 'start'>;

const SPECS: readonly SegmentSpec[] = [
  { id: 'upper-outer-left', seconds: 15, row: 'upper', side: 'left', surface: 'outer', cols: LEFT, motion: 'circles', voice: 'seg0' },
  { id: 'upper-outer-right', seconds: 15, row: 'upper', side: 'right', surface: 'outer', cols: RIGHT, motion: 'circles', voice: 'seg1' },
  { id: 'lower-outer-left', seconds: 15, row: 'lower', side: 'left', surface: 'outer', cols: LEFT, motion: 'circles', voice: 'seg2' },
  { id: 'lower-outer-right', seconds: 15, row: 'lower', side: 'right', surface: 'outer', cols: RIGHT, motion: 'circles', voice: 'seg3' },
  { id: 'upper-inner-back', seconds: 10, row: 'upper', side: 'both', surface: 'inner', cols: BACK, motion: 'circles', voice: 'seg4' },
  { id: 'upper-inner-front', seconds: 8, row: 'upper', side: 'both', surface: 'inner', cols: FRONT, motion: 'flick', voice: 'seg5' },
  { id: 'lower-inner-back', seconds: 10, row: 'lower', side: 'both', surface: 'inner', cols: BACK, motion: 'circles', voice: 'seg6' },
  { id: 'lower-inner-front', seconds: 8, row: 'lower', side: 'both', surface: 'inner', cols: FRONT, motion: 'flick', voice: 'seg7' },
  { id: 'chewing', seconds: 15, row: 'both', side: 'both', surface: 'chewing', cols: ALL, motion: 'scrub', voice: 'seg8' },
  { id: 'tongue', seconds: 9, row: 'both', side: 'both', surface: 'tongue', cols: [], motion: 'tongue', voice: 'seg9' },
];

export const SEGMENTS: readonly Segment[] = SPECS.reduce<Segment[]>((acc, spec, index) => {
  const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].seconds : 0;
  acc.push({ ...spec, index, start });
  return acc;
}, []);

export const SEGMENT_COUNT = SEGMENTS.length;
export const SESSION_SECONDS = SEGMENTS.reduce((s, seg) => s + seg.seconds, 0); // 120

export function clampElapsed(elapsed: number): number {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(elapsed, SESSION_SECONDS);
}

/** Index of the segment active at `elapsed` seconds. */
export function segmentIndexAt(elapsed: number): number {
  const e = clampElapsed(elapsed);
  for (let i = SEGMENTS.length - 1; i >= 0; i--) if (e >= SEGMENTS[i].start) return i;
  return 0;
}

export function segmentAt(elapsed: number): Segment {
  return SEGMENTS[segmentIndexAt(elapsed)];
}

/** Progress 0..1 through a segment at `elapsed`. */
export function segmentProgress(elapsed: number, index: number): number {
  const s = SEGMENTS[index];
  return Math.max(0, Math.min(1, (clampElapsed(elapsed) - s.start) / s.seconds));
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
