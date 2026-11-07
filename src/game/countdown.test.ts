import { describe, expect, it } from 'vitest';
import { COUNTDOWN_TOTAL_SECONDS, countdownAt } from './countdown';

describe('countdown', () => {
  it('shows 3, 2, 1 and never 4', () => {
    expect(countdownAt(0).label).toBe('3');
    expect(countdownAt(0.99).label).toBe('3');
    expect(countdownAt(1).label).toBe('2');
    expect(countdownAt(1.5).label).toBe('2');
    expect(countdownAt(2.2).label).toBe('1');
    expect(countdownAt(-1).label).toBe('3');
  });

  it('shows GO! briefly before starting the session', () => {
    expect(countdownAt(3).label).toBe('GO!');
    expect(countdownAt(3).started).toBe(false);
    expect(countdownAt(3.4).label).toBe('GO!');
    expect(countdownAt(COUNTDOWN_TOTAL_SECONDS).started).toBe(true);
  });

  it('changes step exactly three times for beeps', () => {
    const steps = new Set<number>();
    for (let t = 0; t < COUNTDOWN_TOTAL_SECONDS; t += 1 / 60) steps.add(countdownAt(t).step);
    expect([...steps].sort()).toEqual([0, 1, 2, 3]);
    expect([...steps].filter((s) => s > 0)).toHaveLength(3);
  });
});
