import { describe, expect, it } from 'vitest';
import {
  SUIT_UNLOCK_STARS,
  type SessionRecord,
  addDays,
  computeStars,
  computeStreak,
  dateKey,
  isSuitUnlocked,
  slotForDate,
  totalStars,
} from './scoring';

function rec(partial: Partial<SessionRecord> & { dateKey: string }): SessionRecord {
  return {
    startedAt: 0,
    slot: 'morning',
    heroId: 'ironman',
    suitId: 'classic',
    elapsed: 120,
    completed: true,
    stars: 2,
    ...partial,
  };
}

describe('stars', () => {
  it('awards nothing for a very early quit', () => {
    expect(computeStars({ elapsed: 12, completed: false, slot: 'morning', sessionsToday: [] })).toBe(0);
  });
  it('awards one star for an early quit after 30 s', () => {
    expect(computeStars({ elapsed: 30, completed: false, slot: 'morning', sessionsToday: [] })).toBe(1);
    expect(computeStars({ elapsed: 110, completed: false, slot: 'morning', sessionsToday: [] })).toBe(1);
  });
  it('awards two stars for a full session', () => {
    expect(computeStars({ elapsed: 120, completed: true, slot: 'morning', sessionsToday: [] })).toBe(2);
    expect(
      computeStars({ elapsed: 120, completed: true, slot: 'morning', sessionsToday: [{ slot: 'morning', completed: true }] }),
    ).toBe(2);
  });
  it('awards three stars when morning and evening are both done', () => {
    expect(
      computeStars({ elapsed: 120, completed: true, slot: 'evening', sessionsToday: [{ slot: 'morning', completed: true }] }),
    ).toBe(3);
    expect(
      computeStars({ elapsed: 120, completed: true, slot: 'evening', sessionsToday: [{ slot: 'morning', completed: false }] }),
    ).toBe(2);
  });
});

describe('dates and slots', () => {
  it('splits morning / evening at noon', () => {
    expect(slotForDate(new Date(2026, 0, 1, 7, 30))).toBe('morning');
    expect(slotForDate(new Date(2026, 0, 1, 11, 59))).toBe('morning');
    expect(slotForDate(new Date(2026, 0, 1, 12, 0))).toBe('evening');
    expect(slotForDate(new Date(2026, 0, 1, 20, 0))).toBe('evening');
  });
  it('builds local date keys and adds days across month boundaries', () => {
    expect(dateKey(new Date(2026, 1, 28, 23, 0))).toBe('2026-02-28');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('streak', () => {
  const today = new Date(2026, 10, 7, 9, 0); // 2026-11-07

  it('is zero with no completed sessions', () => {
    const s = computeStreak([rec({ dateKey: '2026-11-07', completed: false })], today);
    expect(s.current).toBe(0);
    expect(s.best).toBe(0);
    expect(s.brushedToday).toBe(false);
  });

  it('counts consecutive days ending today', () => {
    const s = computeStreak(
      [rec({ dateKey: '2026-11-05' }), rec({ dateKey: '2026-11-06' }), rec({ dateKey: '2026-11-07' })],
      today,
    );
    expect(s.current).toBe(3);
    expect(s.best).toBe(3);
    expect(s.brushedToday).toBe(true);
  });

  it('keeps the streak alive if today is not brushed yet but yesterday was', () => {
    const s = computeStreak([rec({ dateKey: '2026-11-05' }), rec({ dateKey: '2026-11-06' })], today);
    expect(s.current).toBe(2);
    expect(s.brushedToday).toBe(false);
  });

  it('breaks the streak after a missed day and remembers the best run', () => {
    const s = computeStreak(
      [
        rec({ dateKey: '2026-11-01' }),
        rec({ dateKey: '2026-11-02' }),
        rec({ dateKey: '2026-11-03' }),
        rec({ dateKey: '2026-11-04' }),
        rec({ dateKey: '2026-11-07' }),
      ],
      today,
    );
    expect(s.current).toBe(1);
    expect(s.best).toBe(4);
  });

  it('counts perfect days (morning + evening)', () => {
    const s = computeStreak(
      [
        rec({ dateKey: '2026-11-06', slot: 'morning' }),
        rec({ dateKey: '2026-11-06', slot: 'evening' }),
        rec({ dateKey: '2026-11-07', slot: 'morning' }),
        rec({ dateKey: '2026-11-07', slot: 'morning' }),
      ],
      today,
    );
    expect(s.perfectDays).toBe(1);
  });
});

describe('unlocks', () => {
  it('unlocks the second suit after enough stars with that hero', () => {
    const records = [
      rec({ dateKey: '2026-11-01', heroId: 'batman', stars: 3 }),
      rec({ dateKey: '2026-11-02', heroId: 'batman', stars: 2 }),
      rec({ dateKey: '2026-11-03', heroId: 'ironman', stars: 3 }),
    ];
    expect(isSuitUnlocked(records, 'batman', 0)).toBe(true);
    expect(isSuitUnlocked(records, 'batman', 1)).toBe(false);
    expect(isSuitUnlocked([...records, rec({ dateKey: '2026-11-04', heroId: 'batman', stars: 1 })], 'batman', 1)).toBe(true);
    expect(SUIT_UNLOCK_STARS).toBe(6);
    expect(totalStars(records)).toBe(8);
  });
});
