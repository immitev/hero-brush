import { describe, expect, it } from 'vitest';
import { SEGMENTS, SEGMENT_COUNT, SESSION_SECONDS, formatClock, isSessionComplete, segmentIndexAt, segmentProgress, timeLeft } from './segments';

describe('segments', () => {
  it('cover exactly two minutes with contiguous timing', () => {
    expect(SESSION_SECONDS).toBe(120);
    let t = 0;
    for (const s of SEGMENTS) {
      expect(s.start).toBe(t);
      expect(s.seconds).toBeGreaterThan(0);
      t += s.seconds;
    }
    expect(t).toBe(120);
    expect(SEGMENTS.map((s) => s.index)).toEqual([...Array(SEGMENT_COUNT).keys()]);
  });

  it('cover every surface of every tooth once, plus the tongue last', () => {
    const covered = new Map<string, number>();
    for (const s of SEGMENTS) {
      const rows = s.row === 'both' ? ['upper', 'lower'] : [s.row];
      for (const row of rows) for (const col of s.cols) covered.set(`${row}/${col}/${s.surface}`, (covered.get(`${row}/${col}/${s.surface}`) ?? 0) + 1);
    }
    for (const row of ['upper', 'lower']) {
      for (let col = 0; col < 12; col++) {
        for (const surface of ['outer', 'inner', 'chewing']) expect(covered.get(`${row}/${col}/${surface}`), `${row}/${col}/${surface}`).toBe(1);
      }
    }
    expect(SEGMENTS[SEGMENTS.length - 1].surface).toBe('tongue');
    expect(SEGMENTS[SEGMENTS.length - 1].seconds).toBeGreaterThanOrEqual(8);
  });

  it('uses the right motion for each surface', () => {
    for (const s of SEGMENTS) {
      if (s.surface === 'outer') expect(s.motion).toBe('circles');
      if (s.surface === 'inner' && s.cols.every((c) => c <= 3 || c >= 8)) expect(s.motion).toBe('circles');
      if (s.surface === 'inner' && s.cols.every((c) => c >= 4 && c <= 7)) expect(s.motion).toBe('flick');
      if (s.surface === 'chewing') expect(s.motion).toBe('scrub');
      if (s.surface === 'tongue') expect(s.motion).toBe('tongue');
    }
    expect(SEGMENTS.filter((s) => s.motion === 'flick')).toHaveLength(2);
  });

  it('maps elapsed time to segments and progress', () => {
    expect(segmentIndexAt(0)).toBe(0);
    expect(segmentIndexAt(14.99)).toBe(0);
    expect(segmentIndexAt(15)).toBe(1);
    expect(segmentIndexAt(60)).toBe(4);
    expect(segmentIndexAt(70)).toBe(5);
    expect(segmentIndexAt(111)).toBe(9);
    expect(segmentIndexAt(120)).toBe(9);
    expect(segmentIndexAt(-3)).toBe(0);
    expect(segmentProgress(7.5, 0)).toBeCloseTo(0.5);
    expect(segmentProgress(7.5, 1)).toBe(0);
    expect(segmentProgress(40, 1)).toBe(1);
  });

  it('tracks remaining time, completion and the clock format', () => {
    expect(timeLeft(0)).toBe(120);
    expect(timeLeft(100)).toBe(20);
    expect(timeLeft(130)).toBe(0);
    expect(isSessionComplete(119.99)).toBe(false);
    expect(isSessionComplete(120)).toBe(true);
    expect(formatClock(120)).toBe('2:00');
    expect(formatClock(59.9)).toBe('1:00');
    expect(formatClock(59)).toBe('0:59');
    expect(formatClock(0)).toBe('0:00');
  });
});
