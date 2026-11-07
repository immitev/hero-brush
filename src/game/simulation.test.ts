import { describe, expect, it } from 'vitest';
import { batman } from '../heroes/batman/hero';
import { ironman } from '../heroes/ironman/hero';
import { spiderman } from '../heroes/spiderman/hero';
import { teethForZone, zoneHome } from './mouth';
import { createRuntime, type Runtime } from './runtime';
import { SCRUB_SECONDS, stepSimulation } from './simulation';

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function run(rt: Runtime, hero = ironman, until: number, onStep?: (rt: Runtime) => void, dt = 1 / 60) {
  const random = seeded();
  while (rt.elapsed < until) {
    rt.elapsed += dt;
    stepSimulation(rt, { hero, random });
    onStep?.(rt);
  }
}

describe('simulation', () => {
  it("spawns monsters only on the current zone's teeth and the hero scrubs them away", () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    run(rt, ironman, 10);
    const zoneTeeth = new Set(teethForZone(0).map((t) => t.index));
    for (const m of rt.monsters) expect(zoneTeeth.has(m.toothIndex)).toBe(true);
    expect(rt.kills).toBeGreaterThan(2);
    expect(rt.events.some((e) => e.type === 'pop')).toBe(true);
    expect(rt.events.some((e) => e.type === 'scrub')).toBe(true);
  });

  it('travels to the monster, scrubs for two beats, foams it, then it pops', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    const states = new Set<string>();
    let scrubbing: { at: number; target: number } | null = null;
    let foamedAt = -1;
    let travelledWhileTargeting = false;
    run(rt, batman, 8, (r) => {
      states.add(r.hero.state);
      if (r.hero.state === 'travel' && r.hero.targetId > 0) travelledWhileTargeting = true;
      if (r.hero.state === 'scrub' && !scrubbing) scrubbing = { at: r.elapsed, target: r.hero.targetId };
      if (foamedAt < 0 && r.monsters.some((m) => m.state === 'foamed')) foamedAt = r.elapsed;
    });
    expect([...states]).toEqual(expect.arrayContaining(['travel', 'scrub']));
    expect(travelledWhileTargeting).toBe(true);
    expect(scrubbing).not.toBeNull();
    expect(foamedAt).toBeGreaterThan(0);
    expect(foamedAt - scrubbing!.at).toBeGreaterThanOrEqual(SCRUB_SECONDS - 0.05);
    expect(rt.events.filter((e) => e.type === 'foamed').length).toBeGreaterThan(0);
  });

  it('scrub strokes land on 8th notes', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    const strokeTimes: number[] = [];
    run(rt, spiderman, 8, (r) => {
      for (const e of r.events) if (e.type === 'scrub') strokeTimes.push(r.elapsed);
      r.events.length = 0;
    });
    expect(strokeTimes.length).toBeGreaterThan(4);
    for (const st of strokeTimes) {
      const phase = (st / 0.25) % 1; // position within an 8th note, allowing one frame of latency
      expect(phase).toBeLessThan(1 / 60 / 0.25 + 1e-6);
    }
  });

  it('rests at the zone home when nothing is alive and stays within the arena', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    rt.nextSpawnIn = 999; // no monsters ever
    run(rt, ironman, 3);
    const home = zoneHome(0);
    for (let i = 0; i < 3; i++) expect(rt.hero.pos[i]).toBeCloseTo(home[i], 0);
    expect(rt.hero.state).toBe('idle');
  });

  it('scrubs the boss during the last 20 seconds and defeats it at 0:00', () => {
    const rt = createRuntime();
    rt.phase = 'playing';
    rt.elapsed = 99;
    rt.lastSimT = 99;
    run(rt, ironman, 105);
    expect(rt.bossActive).toBe(true);
    expect(rt.bossHealth).toBeCloseTo(0.75, 1);
    expect(rt.hero.targetId).toBe(-1);
    expect(rt.hero.state).toBe('scrub');
    expect(rt.events.some((e) => e.type === 'bossFoam')).toBe(true);
    expect(rt.events.some((e) => e.type === 'bossHit')).toBe(true);
    expect(rt.bossFoam).toBeGreaterThan(0);
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
