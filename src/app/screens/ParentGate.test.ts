import { describe, expect, it } from 'vitest';
import { makeQuestion } from './ParentGate';

describe('parent gate questions', () => {
  it('produces two-step arithmetic with answers outside the kid-guessable range', () => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < 200; i++) {
      const q = makeQuestion(rnd);
      expect(q.text).toMatch(/^\d+ × \d+ [+−] \d+$/);
      expect(q.answer).toBeGreaterThanOrEqual(6 * 3 - 9);
      expect(q.answer).toBeLessThanOrEqual(12 * 12 + 9);
    }
  });
});
