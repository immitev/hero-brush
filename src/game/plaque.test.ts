import { describe, expect, it } from 'vitest';
import { brushPoseAt, stopsForSegment } from './choreo';
import { tooth } from './mouth';
import { CELLS_U, CELLS_V, CLEAN_THRESHOLD, brushContact, cellCenter, cellOffset, createPlaque, finishSurface, overallCleanliness, surfaceCleanliness } from './plaque';
import { ironman } from '../heroes/ironman/hero';
import { createRuntime } from './runtime';
import { stepSimulation } from './simulation';

describe('plaque cells', () => {
  it('lays cells from the gumline to the edge on the outer face', () => {
    const t = tooth('upper', 5);
    const gum = cellCenter(t, 'outer', 3, 0);
    const edge = cellCenter(t, 'outer', 3, CELLS_V - 1);
    expect(gum[1]).toBeGreaterThan(edge[1]); // upper: gum is up
    expect(gum[2]).toBeGreaterThan(t.pos[2]); // outer face towards the lips
    const inner = cellCenter(t, 'inner', 3, 0);
    expect(inner[2]).toBeLessThan(t.pos[2]);
    const l = tooth('lower', 5);
    expect(cellCenter(l, 'outer', 0, 0)[1]).toBeLessThan(cellCenter(l, 'outer', 0, CELLS_V - 1)[1]);
    expect(cellOffset(1, 'inner', 0, 0)).toBe(96 + 32);
  });
});

describe('brush contact clears plaque where the head passes', () => {
  it('cleans the brushed outer surfaces and nothing else', () => {
    const p = createPlaque();
    const stop = stopsForSegment(0)[0]; // upper outer left, back molars
    const teeth = stop.teeth;
    let cleaned: number[] = [];
    for (let u = 0; u < stop.seconds; u += 1 / 60) {
      const res = brushContact(p, brushPoseAt(stop.start + u), teeth, 'outer', 1 / 60);
      cleaned = cleaned.concat(res.cleaned.map((c) => c.tooth));
    }
    for (const ti of teeth) {
      expect(surfaceCleanliness(p, ti, 'outer'), `tooth ${ti} outer`).toBeGreaterThan(0.6);
      expect(surfaceCleanliness(p, ti, 'inner'), `tooth ${ti} inner`).toBe(0);
      expect(surfaceCleanliness(p, ti, 'chewing'), `tooth ${ti} chewing`).toBe(0);
    }
    // a tooth three places along the row is untouched
    expect(surfaceCleanliness(p, tooth('upper', 4).index, 'outer')).toBe(0);
    expect(overallCleanliness(p)).toBeLessThan(0.05);
  });

  it('the gumline row only comes clean with the bristles angled towards the gum', () => {
    const t = tooth('upper', 1);
    const stop = stopsForSegment(0)[0];
    const angled = brushPoseAt(stop.start + 1.0); // 45° pose
    const flat = { ...angled, bristle: [-stop.normal[0], 0, -stop.normal[2]] as [number, number, number] };
    const pa = createPlaque();
    const pf = createPlaque();
    for (let i = 0; i < 60; i++) {
      brushContact(pa, angled, [t.index], 'outer', 1 / 60);
      brushContact(pf, flat, [t.index], 'outer', 1 / 60);
    }
    const gumRow = (p: ReturnType<typeof createPlaque>) => {
      let s = 0;
      for (let iu = 0; iu < CELLS_U; iu++) s += p.cells[cellOffset(t.index, 'outer', iu, 0)];
      return s / CELLS_U;
    };
    expect(gumRow(pa)).toBeGreaterThan(gumRow(pf) * 1.5);
  });

  it('reports a surface once when it crosses the clean threshold', () => {
    const p = createPlaque();
    const t = tooth('lower', 6).index;
    expect(finishSurface(p, t, 'chewing')).toBe(true);
    expect(finishSurface(p, t, 'chewing')).toBe(false);
    expect(surfaceCleanliness(p, t, 'chewing')).toBeGreaterThanOrEqual(CLEAN_THRESHOLD);
  });
});

describe('simulation', () => {
  function run(until: number, from = 0) {
    const rt = createRuntime();
    rt.phase = 'playing';
    rt.elapsed = from;
    rt.lastSimT = from;
    while (rt.elapsed < until) {
      rt.elapsed += 1 / 60;
      stepSimulation(rt, { hero: ironman });
    }
    return rt;
  }

  it('cleans the first segment completely by the time it ends and emits sparkles', () => {
    const rt = run(15.2);
    const stop0 = stopsForSegment(0);
    for (const s of stop0) for (const ti of s.teeth) expect(surfaceCleanliness(rt.plaque, ti, 'outer')).toBe(1);
    expect(rt.events.some((e) => e.type === 'toothClean')).toBe(true);
    expect(rt.events.some((e) => e.type === 'stroke')).toBe(true);
    expect(rt.events.some((e) => e.type === 'segmentDone' && e.segment === 0)).toBe(true);
    expect(rt.surfacesDone).toBe(6);
  });

  it('the hero follows the brush grip and reports travel between stops', () => {
    const rt = run(1.0);
    const d = Math.hypot(rt.hero.pos[0] - rt.brush.pos[0], rt.hero.pos[2] - rt.brush.pos[2]);
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(2.5);
    expect(rt.hero.state).toBe('brush');
    // between the 1st and 2nd stop the hero travels (and moves) before settling into its stance
    const stop1 = stopsForSegment(0)[1];
    const rt2 = createRuntime();
    rt2.phase = 'playing';
    rt2.elapsed = stop1.start - 0.5;
    rt2.lastSimT = rt2.elapsed;
    const states = new Set<string>();
    let maxSpeed = 0;
    while (rt2.elapsed < stop1.start + 0.6) {
      rt2.elapsed += 1 / 60;
      stepSimulation(rt2, { hero: ironman });
      states.add(rt2.hero.state);
      maxSpeed = Math.max(maxSpeed, rt2.hero.speed);
    }
    expect(states.has('travel')).toBe(true);
    expect(maxSpeed).toBeGreaterThan(0.5);
    expect(rt2.hero.state).toBe('brush');
  });

  it('ends with every surface clean', () => {
    const rt = run(120.2);
    expect(rt.clean).toBeGreaterThan(0.999);
    expect(rt.surfacesDone).toBe(24 * 3);
  });
});
