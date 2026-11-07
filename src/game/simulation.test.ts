import { describe, expect, it } from 'vitest';
import { ironman } from '../heroes/ironman/hero';
import { spiderman } from '../heroes/spiderman/hero';
import { teethForZone } from './mouth';
import { createRuntime } from './runtime';
import { stepSimulation } from './simulation';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function run(rt: ReturnType<typeof createRuntime>, hero = ironman, until: number, dt = 1 / 60) {
  const random = seeded();
  while (rt.elapsed < until) {
    rt.elapsed += dt;
    stepSimulation(rt, { hero, random });
  }
}

describe('simulation', () => {
  it('spawns monsters only on the current zone\'s teeth and the hero pops them', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    run(rt, ironman, 8);
    const zoneTeeth = new Set(teethForZone(0).map((t) => t.index));
    for (const m of rt.monsters) expect(zoneTeeth.has(m.toothIndex)).toBe(true);
    expect(rt.kills).toBeGreaterThan(3);
    expect(rt.events.some((e) => e.type === 'pop')).toBe(true);
  });

  it('webs cocoon monsters before they pop', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    const random = seeded(7);
    let sawCocoon = false;
    while (rt.elapsed < 6) {
      rt.elapsed += 1 / 60;
      stepSimulation(rt, { hero: spiderman, random });
      if (rt.monsters.some((m) => m.state === 'cocooned')) sawCocoon = true;
    }
    expect(sawCocoon).toBe(true);
    expect(rt.kills).toBe(0); // web kills are counted as pops via cocoon, not direct kills
  });

  it('fights the boss during the last 20 seconds and defeats it at 0:00', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    rt.elapsed = 99;
    run(rt, ironman, 105);
    expect(rt.bossActive).toBe(true);
    expect(rt.bossHealth).toBeCloseTo(0.75, 1);
    expect(rt.events.some((e) => e.type === 'bossHit')).toBe(true);
    expect(rt.monsters.filter((m) => m.state === 'rising' || m.state === 'alive')).toHaveLength(0);
    rt.events.length = 0;
    run(rt, ironman, 120.5);
    expect(rt.bossActive).toBe(false);
    expect(rt.bossHealth).toBe(0);
    expect(rt.events.some((e) => e.type === 'bossDefeated')).toBe(true);
  });

  it('emits a zoneClean event when a zone finishes', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    run(rt, ironman, 20.5);
    expect(rt.events.filter((e) => e.type === 'zoneClean').map((e) => (e as { zoneIndex: number }).zoneIndex)).toEqual([0]);
    expect(rt.zoneIndex).toBe(1);
  });
});
