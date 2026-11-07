/**
 * Per-frame session simulation: follows the choreography (brush pose, hero
 * placement), clears plaque under the brush head and emits FX events.
 * Driven purely by game time (`rt.elapsed`) so it behaves identically at
 * `?fast=` speeds.
 */
import type { HeroPack } from '../heroes/types';
import { STOPS, brushPoseAt, heroPoseFor, stopIndexAt } from './choreo';
import { TEETH, dist, lerp3, surfaceCenter } from './mouth';
import { type PlaqueSurface, brushContact, finishSurface, overallCleanliness } from './plaque';
import type { Runtime } from './runtime';
import { SEGMENTS, segmentIndexAt, segmentProgress } from './segments';

export interface SimOptions {
  hero: HeroPack;
}

export function stepSimulation(rt: Runtime, opts: SimOptions): void {
  const t = rt.elapsed;
  const dt = Math.max(0, Math.min(0.25, t - rt.lastSimT));
  rt.lastSimT = t;

  // --- segment / stop bookkeeping ---
  const prevSegment = rt.segmentIndex;
  const prevStop = rt.stopIndex;
  const si = segmentIndexAt(t);
  rt.segmentIndex = si;
  rt.segmentProgress = segmentProgress(t, si);
  rt.stopIndex = stopIndexAt(t);

  // when a stop ends, make sure nothing was left behind on its teeth
  if (rt.stopIndex !== prevStop) {
    for (let i = prevStop; i < rt.stopIndex; i++) finishStop(rt, i);
  }
  if (si !== prevSegment) rt.events.push({ type: 'segmentDone', segment: prevSegment });

  // --- brush + plaque ---
  const prevCycle = rt.brush.cycle;
  const prevMotion = rt.brush.motion;
  rt.brush = brushPoseAt(t);
  const stop = STOPS[rt.stopIndex];
  if (rt.brush.contact && stop.teeth.length > 0) {
    const res = brushContact(rt.plaque, rt.brush, stop.teeth, stop.surface as PlaqueSurface, dt);
    for (const c of res.cleaned) {
      rt.surfacesDone++;
      rt.events.push({ type: 'toothClean', pos: cellCenterOf(c.tooth, c.surface) });
    }
  }
  // one foam puff per stroke cycle (circle / flick / scrub / tongue stroke)
  if (rt.brush.contact && rt.brush.motion === prevMotion && rt.brush.cycle < prevCycle) {
    rt.events.push({ type: 'stroke', pos: rt.brush.pos, motion: rt.brush.motion });
  }
  if (dt > 0 && (rt.stopIndex !== prevStop || Math.floor(t * 4) !== Math.floor((t - dt) * 4))) {
    rt.clean = overallCleanliness(rt.plaque);
  }

  // --- hero follows the grip (damped, speed-limited so travel reads as movement) ---
  const target = heroPoseFor(stop, rt.brush);
  const d = dist(target.pos, rt.hero.pos);
  const maxStep = opts.hero.travelSpeed * dt;
  if (d > 0.001 && dt > 0) {
    const damped = d * (1 - Math.exp(-dt * 9));
    const step = Math.min(d, maxStep, Math.max(damped, Math.min(d, 0.002)));
    rt.hero.pos = lerp3(rt.hero.pos, target.pos, step / d);
    rt.hero.speed = step / dt;
  } else {
    rt.hero.speed = 0;
  }
  rt.hero.facing = target.facing;
  // "travel" only while actually moving to the next stop; the lift phase of a flick
  // or a tongue stroke keeps the hero in its brushing stance
  rt.hero.state = !rt.brush.contact && d > 0.3 ? 'travel' : 'brush';
}

function finishStop(rt: Runtime, stopIndex: number): void {
  const s = STOPS[stopIndex];
  if (!s || s.teeth.length === 0) return;
  for (const ti of s.teeth) {
    if (finishSurface(rt.plaque, ti, s.surface as PlaqueSurface)) {
      rt.surfacesDone++;
      rt.events.push({ type: 'toothClean', pos: cellCenterOf(ti, s.surface as PlaqueSurface) });
    }
  }
}

function cellCenterOf(toothIndex: number, surface: PlaqueSurface) {
  return surfaceCenter(TEETH[toothIndex], surface);
}

export { SEGMENTS };
