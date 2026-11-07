import { describe, expect, it } from 'vitest';
import { GameClock } from './clock';

function makeClock() {
  let t = 1000;
  const clock = new GameClock(() => t);
  return { clock, advance: (ms: number) => (t += ms) };
}

describe('GameClock', () => {
  it('accumulates elapsed game time from real-time deltas', () => {
    const { clock, advance } = makeClock();
    clock.start();
    advance(100);
    expect(clock.tick()).toBeCloseTo(0.1);
    advance(50);
    clock.tick();
    expect(clock.elapsed).toBeCloseTo(0.15);
  });

  it('does not advance before start or while paused', () => {
    const { clock, advance } = makeClock();
    advance(500);
    expect(clock.tick()).toBe(0);
    expect(clock.elapsed).toBe(0);
    clock.start();
    advance(100);
    clock.tick();
    clock.pause();
    advance(5000);
    clock.tick();
    expect(clock.elapsed).toBeCloseTo(0.1);
    clock.resume();
    advance(100);
    clock.tick();
    expect(clock.elapsed).toBeCloseTo(0.2);
  });

  it('clamps long gaps (tab throttling / sleep) to maxDelta', () => {
    const { clock, advance } = makeClock();
    clock.start();
    advance(60_000);
    clock.tick();
    expect(clock.elapsed).toBeCloseTo(clock.maxDelta);
  });

  it('applies the speed multiplier', () => {
    const { clock, advance } = makeClock();
    clock.speed = 10;
    clock.start();
    advance(100);
    clock.tick();
    expect(clock.elapsed).toBeCloseTo(1);
  });

  it('clamps the raw frame delta before applying speed (slow frames keep full speed)', () => {
    const { clock, advance } = makeClock();
    clock.maxDelta = 0.25;
    clock.speed = 10;
    clock.start();
    // a 200 ms frame is under the raw clamp, so it must yield 2.0 game seconds
    advance(200);
    expect(clock.tick()).toBeCloseTo(2.0);
    // a 2 s stall is clamped to 0.25 s raw, then scaled: 2.5 game seconds
    advance(2000);
    expect(clock.tick()).toBeCloseTo(2.5);
    expect(clock.elapsed).toBeCloseTo(4.5);
  });

  it('ignores negative deltas', () => {
    let t = 1000;
    const clock = new GameClock(() => t);
    clock.start();
    t -= 100;
    expect(clock.tick()).toBe(0);
  });

  it('start() resets elapsed', () => {
    const { clock, advance } = makeClock();
    clock.start();
    advance(100);
    clock.tick();
    clock.start();
    expect(clock.elapsed).toBe(0);
  });
});
