import { describe, expect, it } from 'vitest';
import {
  BOSS_START,
  SESSION_SECONDS,
  ZONES,
  bossProgress,
  formatClock,
  isBossActive,
  isSessionComplete,
  timeLeft,
  zoneCleanliness,
  zoneIndexAt,
  zoneProgress,
} from './zones';

describe('zones', () => {
  it('has six zones in the PLAN.md order', () => {
    expect(ZONES.map((z) => z.id)).toEqual([
      'upper-left-out',
      'upper-right-out',
      'lower-left-out',
      'lower-right-out',
      'upper-in',
      'lower-in',
    ]);
  });

  it('maps elapsed time to the active zone', () => {
    expect(zoneIndexAt(0)).toBe(0);
    expect(zoneIndexAt(19.99)).toBe(0);
    expect(zoneIndexAt(20)).toBe(1);
    expect(zoneIndexAt(59)).toBe(2);
    expect(zoneIndexAt(100)).toBe(5);
    expect(zoneIndexAt(119.9)).toBe(5);
    expect(zoneIndexAt(120)).toBe(5);
    expect(zoneIndexAt(999)).toBe(5);
    expect(zoneIndexAt(-5)).toBe(0);
  });

  it('computes per-zone progress and cleanliness', () => {
    expect(zoneProgress(10, 0)).toBeCloseTo(0.5);
    expect(zoneProgress(10, 1)).toBe(0);
    expect(zoneProgress(45, 1)).toBe(1);
    expect(zoneCleanliness(50)).toEqual([1, 1, 0.5, 0, 0, 0]);
    expect(zoneCleanliness(SESSION_SECONDS)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('activates the boss for the final 20 seconds', () => {
    expect(BOSS_START).toBe(100);
    expect(isBossActive(99.9)).toBe(false);
    expect(isBossActive(100)).toBe(true);
    expect(isBossActive(119.9)).toBe(true);
    expect(isBossActive(120)).toBe(false);
    expect(bossProgress(90)).toBe(0);
    expect(bossProgress(110)).toBeCloseTo(0.5);
    expect(bossProgress(120)).toBe(1);
  });

  it('tracks remaining time and completion', () => {
    expect(timeLeft(0)).toBe(120);
    expect(timeLeft(100)).toBe(20);
    expect(timeLeft(130)).toBe(0);
    expect(isSessionComplete(119.99)).toBe(false);
    expect(isSessionComplete(120)).toBe(true);
  });

  it('formats the clock', () => {
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(119.2)).toBe('2:00');
    expect(formatClock(59.9)).toBe('1:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(-1)).toBe('0:00');
  });
});
