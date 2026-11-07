import { SESSION_SECONDS } from './zones';

export type Slot = 'morning' | 'evening';

export interface SessionRecord {
  id?: number;
  /** Epoch ms when the session started. */
  startedAt: number;
  /** Local date key YYYY-MM-DD. */
  dateKey: string;
  slot: Slot;
  heroId: string;
  suitId: string;
  /** Game seconds actually brushed. */
  elapsed: number;
  completed: boolean;
  stars: number;
}

/** Minimum brushing time for a session to count at all. */
export const MIN_RECORD_SECONDS = 10;
/** Early quit still earns a star if at least this much was brushed. */
export const ONE_STAR_SECONDS = 30;
/** Stars needed (per hero) to unlock that hero's second suit. */
export const SUIT_UNLOCK_STARS = 6;

export function slotForDate(d: Date): Slot {
  return d.getHours() < 12 ? 'morning' : 'evening';
}

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return dateKey(dt);
}

export interface StarInput {
  elapsed: number;
  completed: boolean;
  slot: Slot;
  /** Completed sessions already recorded today (before this one). */
  sessionsToday: Pick<SessionRecord, 'slot' | 'completed'>[];
}

/**
 * 0 stars: quit before 30 s.
 * 1 star : brushed at least 30 s but quit early.
 * 2 stars: completed the full session (all six zones).
 * 3 stars: completed, and the other slot (morning/evening) was also completed today.
 */
export function computeStars({ elapsed, completed, slot, sessionsToday }: StarInput): number {
  const done = completed || elapsed >= SESSION_SECONDS;
  if (!done) return elapsed >= ONE_STAR_SECONDS ? 1 : 0;
  const otherSlotDone = sessionsToday.some((s) => s.completed && s.slot !== slot);
  return otherSlotDone ? 3 : 2;
}

export interface StreakInfo {
  /** Consecutive days (ending today or yesterday) with a completed session. */
  current: number;
  best: number;
  /** Days with both morning and evening completed. */
  perfectDays: number;
  /** Whether today already has a completed session. */
  brushedToday: boolean;
}

export function computeStreak(records: readonly SessionRecord[], today: Date = new Date()): StreakInfo {
  const days = new Map<string, Set<Slot>>();
  for (const r of records) {
    if (!r.completed) continue;
    let set = days.get(r.dateKey);
    if (!set) {
      set = new Set();
      days.set(r.dateKey, set);
    }
    set.add(r.slot);
  }
  const todayKey = dateKey(today);
  let perfectDays = 0;
  for (const set of days.values()) if (set.size >= 2) perfectDays++;

  // current streak: walk back from today (or from yesterday if today is not done yet)
  let cursor = days.has(todayKey) ? todayKey : addDays(todayKey, -1);
  let current = 0;
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  // best streak: scan sorted unique days
  const sorted = [...days.keys()].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const k of sorted) {
    run = prev !== null && addDays(prev, 1) === k ? run + 1 : 1;
    if (run > best) best = run;
    prev = k;
  }
  return { current, best, perfectDays, brushedToday: days.has(todayKey) };
}

export function totalStars(records: readonly SessionRecord[]): number {
  return records.reduce((sum, r) => sum + r.stars, 0);
}

export function starsForHero(records: readonly SessionRecord[], heroId: string): number {
  return records.filter((r) => r.heroId === heroId).reduce((sum, r) => sum + r.stars, 0);
}

export function isSuitUnlocked(records: readonly SessionRecord[], heroId: string, suitIndex: number): boolean {
  if (suitIndex === 0) return true;
  return starsForHero(records, heroId) >= SUIT_UNLOCK_STARS * suitIndex;
}
