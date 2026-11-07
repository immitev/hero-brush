/**
 * Monster spawning, hero travel and beat-synced scrubbing.
 * Everything is driven by game time (`rt.elapsed`), so it runs identically at
 * 10x speed in `?fast=1` mode. The hero's position is simulated here (pure,
 * testable); the scene only renders it.
 */
import type { HeroPack } from '../heroes/types';
import {
  type PerchSurface,
  type Vec3,
  bossPositionAt,
  bossRadius,
  bossStandoff,
  perchOn,
  scrubStandoff,
  teethForZone,
  TEETH,
  zoneCenter,
  zoneHome,
} from './mouth';
import type { Monster, Runtime } from './runtime';
import { BOSS_START, ZONES, bossProgress, isBossActive, zoneCleanliness, zoneIndexAt, zoneProgress } from './zones';

export const BEAT_SECONDS = 0.5; // 120 bpm
/** Scrub strokes happen on 8th notes. */
export const STROKE_SECONDS = BEAT_SECONDS / 2;
/** How long a monster is scrubbed before it is fully foamed. */
export const SCRUB_SECONDS = BEAT_SECONDS * 2;
const MONSTER_RISE = 0.45;
const MONSTER_FOAMED = 0.45;
const MONSTER_DIE = 0.25;
const MAX_ALIVE = 4;
const ARRIVE_DIST = 0.12;

export interface SimOptions {
  hero: HeroPack;
  /** Deterministic RNG hook for tests. */
  random?: () => number;
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function stepSimulation(rt: Runtime, opts: SimOptions): void {
  const rnd = opts.random ?? Math.random;
  const t = rt.elapsed;
  const dt = Math.max(0, Math.min(0.25, t - rt.lastSimT));
  rt.lastSimT = t;

  // --- zone bookkeeping ---
  const zi = zoneIndexAt(t);
  rt.zoneIndex = zi;
  rt.zoneProgress = zoneProgress(t, zi);
  const clean = zoneCleanliness(t);
  for (let i = 0; i < clean.length; i++) {
    if (rt.zoneClean[i] < 1 && clean[i] >= 1) rt.events.push({ type: 'zoneClean', zoneIndex: i });
    rt.zoneClean[i] = clean[i];
  }
  const bossWas = rt.bossActive;
  rt.bossActive = isBossActive(t);
  rt.bossHealth = rt.bossActive ? 1 - bossProgress(t) : t >= BOSS_START ? 0 : 1;
  rt.bossPos = bossPositionAt(t);
  if (bossWas && !rt.bossActive && t >= BOSS_START) {
    rt.events.push({ type: 'bossDefeated', pos: rt.bossPos });
    rt.shake = 1;
  }
  rt.shake = Math.max(0, rt.shake - 0.04);

  // --- monster lifecycle ---
  for (let i = rt.monsters.length - 1; i >= 0; i--) {
    const m = rt.monsters[i];
    const age = t - m.stateAt;
    if (m.state === 'rising' && age >= MONSTER_RISE) {
      m.state = 'alive';
      m.stateAt = t;
    } else if (m.state === 'foamed' && age >= MONSTER_FOAMED) {
      m.state = 'dying';
      m.stateAt = t;
      rt.kills++;
      rt.events.push({ type: 'pop', pos: m.pos, color: '#ffffff', count: 14 });
      rt.events.push({ type: 'sparkle', pos: m.pos });
    } else if (m.state === 'dying' && age >= MONSTER_DIE) {
      rt.monsters.splice(i, 1);
    }
  }

  // clear monsters that belong to a previous zone (the hero moved on)
  const zoneTeeth = teethForZone(zi);
  for (const m of rt.monsters) {
    if ((m.state === 'alive' || m.state === 'rising') && !zoneTeeth.some((td) => td.index === m.toothIndex)) {
      m.state = 'dying';
      m.stateAt = t;
      rt.events.push({ type: 'pop', pos: m.pos, color: '#b7e07a', count: 6 });
    }
  }

  // --- spawning (none during the boss fight) ---
  if (!rt.bossActive) {
    const alive = rt.monsters.filter((m) => m.state !== 'dying').length;
    if (alive < MAX_ALIVE && t - rt.lastSpawnAt >= rt.nextSpawnIn) {
      const spawned = spawnMonster(rt, zi, rnd);
      if (spawned) {
        rt.lastSpawnAt = t;
        rt.nextSpawnIn = 0.9 + rnd() * 0.8;
      }
    }
  }

  stepHero(rt, opts.hero, t, dt);
}

function stepHero(rt: Runtime, hero: HeroPack, t: number, dt: number): void {
  const h = rt.hero;

  // --- pick a target ---
  let target: Monster | undefined;
  let dest: Vec3;
  let aim: Vec3 | null = null;
  if (rt.bossActive) {
    h.targetId = -1;
    dest = bossStandoff(rt.bossPos, rt.bossHealth);
    const r = bossRadius(rt.bossHealth);
    aim = [rt.bossPos[0] - r * 0.8, rt.bossPos[1], rt.bossPos[2] + r * 0.4];
  } else {
    target = h.targetId > 0 ? rt.monsters.find((m) => m.id === h.targetId && m.state === 'alive') : undefined;
    if (!target) {
      // nearest live monster
      let best = Infinity;
      for (const m of rt.monsters) {
        if (m.state !== 'alive') continue;
        const d = dist(m.pos, h.pos);
        if (d < best) {
          best = d;
          target = m;
        }
      }
      if (target && target.id !== h.targetId) {
        h.targetId = target.id;
        h.state = 'travel';
      }
    }
    if (target) {
      // approach from the side that is closer to where the hero currently is
      const perch = { pos: target.pos, normal: target.normal };
      const a = scrubStandoff(perch, 1);
      const b = scrubStandoff(perch, -1);
      dest = dist(a, h.pos) <= dist(b, h.pos) ? a : b;
      aim = target.pos;
    } else {
      h.targetId = 0;
      if (h.state === 'scrub') h.state = 'idle';
      dest = zoneHome(rt.zoneIndex);
    }
  }
  h.aim = aim;

  // --- move ---
  const d = dist(dest, h.pos);
  if (d > ARRIVE_DIST) {
    const step = Math.min(d, hero.travelSpeed * dt);
    const k = step / d;
    h.pos = [h.pos[0] + (dest[0] - h.pos[0]) * k, h.pos[1] + (dest[1] - h.pos[1]) * k, h.pos[2] + (dest[2] - h.pos[2]) * k];
    h.speed = dt > 0 ? step / dt : 0;
    if (h.state === 'scrub' && d > 0.6) h.state = 'travel';
    else if (h.state !== 'scrub') h.state = 'travel';
  } else {
    h.speed = 0;
    if (aim) {
      if (h.state !== 'scrub') {
        h.state = 'scrub';
        h.scrubStartedAt = t;
        h.lastStroke = Math.floor(t / STROKE_SECONDS);
      }
    } else {
      h.state = 'idle';
    }
  }

  // --- facing ---
  const look = aim ?? zoneCenter(rt.zoneIndex);
  const fx = look[0] - h.pos[0];
  const fz = look[2] - h.pos[2];
  const fl = Math.hypot(fx, fz) || 1;
  h.facing = [fx / fl, 0, fz / fl];

  // --- scrubbing on the beat (8th notes) ---
  if (h.state === 'scrub' && aim) {
    const stroke = Math.floor(t / STROKE_SECONDS);
    if (stroke > h.lastStroke) {
      h.lastStroke = stroke;
      if (rt.bossActive) {
        rt.events.push({ type: 'bossFoam', pos: aim });
        rt.bossFoam = Math.min(1, rt.bossFoam + 0.08);
        if (stroke % 4 === 0) {
          rt.bossHitAt = t;
          rt.events.push({ type: 'bossHit', pos: aim });
          rt.shake = Math.max(rt.shake, 0.3);
        }
      } else if (target) {
        rt.events.push({ type: 'scrub', pos: target.pos, normal: target.normal });
        target.foam = Math.min(1, target.foam + STROKE_SECONDS / SCRUB_SECONDS);
      }
    }
    if (target && t - h.scrubStartedAt >= SCRUB_SECONDS) {
      target.state = 'foamed';
      target.stateAt = t;
      target.foam = 1;
      rt.events.push({ type: 'foamed', pos: target.pos });
      h.targetId = 0;
      h.state = 'idle';
    }
  }
  if (!rt.bossActive) rt.bossFoam = 0;
}

function spawnMonster(rt: Runtime, zoneIndex: number, rnd: () => number): boolean {
  const zone = ZONES[zoneIndex];
  const candidates = teethForZone(zone).filter((td) => !rt.monsters.some((m) => m.toothIndex === td.index));
  if (candidates.length === 0) return false;
  const tooth = candidates[Math.floor(rnd() * candidates.length)];
  let surface: PerchSurface;
  if (zone.surface === 'outside') surface = 'outside';
  else surface = rnd() < 0.65 ? 'chewing' : 'inside';
  const perch = perchOn(tooth, surface);
  rt.monsters.push({
    id: rt.nextId++,
    toothIndex: tooth.index,
    pos: perch.pos,
    normal: perch.normal,
    state: 'rising',
    stateAt: rt.elapsed,
    bornAt: rt.elapsed,
    seed: rnd(),
    foam: 0,
  });
  return true;
}

export function toothById(index: number) {
  return TEETH[index];
}
