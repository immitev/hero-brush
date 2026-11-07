/**
 * Monster spawning, hero attack rhythm and projectile resolution.
 * Everything is driven by game time (`rt.elapsed`), so it runs identically at
 * 10x speed in `?fast=1` mode.
 */
import type { HeroPack } from '../heroes/types';
import { BOSS_POSITION, type PerchSurface, type Vec3, perchOn, teethForZone, TEETH } from './mouth';
import type { Monster, Runtime } from './runtime';
import { BOSS_START, ZONES, bossProgress, isBossActive, zoneCleanliness, zoneIndexAt, zoneProgress } from './zones';

export const BEAT_SECONDS = 0.5; // 120 bpm
const MONSTER_RISE = 0.45;
const MONSTER_COCOON = 0.55;
const MONSTER_DIE = 0.25;
const MAX_ALIVE = 4;

const PROJECTILE_DURATION: Record<HeroPack['attack'], number> = {
  beam: 0.12,
  web: 0.3,
  batarang: 0.42,
};

export interface SimOptions {
  hero: HeroPack;
  /** Deterministic RNG hook for tests. */
  random?: () => number;
}

export function stepSimulation(rt: Runtime, opts: SimOptions): void {
  const rnd = opts.random ?? Math.random;
  const t = rt.elapsed;

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
  if (bossWas && !rt.bossActive && t >= BOSS_START) {
    rt.events.push({ type: 'bossDefeated', pos: BOSS_POSITION });
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
    } else if (m.state === 'cocooned' && age >= MONSTER_COCOON) {
      m.state = 'dying';
      m.stateAt = t;
      rt.events.push({ type: 'pop', pos: m.pos, color: '#f6f6f6', count: 10 });
    } else if (m.state === 'dying' && age >= MONSTER_DIE) {
      rt.monsters.splice(i, 1);
    }
  }

  // clear monsters that belong to a previous zone (the hero moved on)
  for (const m of rt.monsters) {
    if (m.state === 'alive' && !teethForZone(zi).some((td) => td.index === m.toothIndex)) {
      m.state = 'dying';
      m.stateAt = t;
      rt.events.push({ type: 'pop', pos: m.pos, color: '#9ccf5a', count: 6 });
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

  // --- hero attacks on the beat ---
  const beat = Math.floor(t / BEAT_SECONDS);
  if (beat > rt.lastAttackBeat && beat % Math.max(1, opts.hero.attackEveryBeats) === 0) {
    let target: Monster | undefined;
    if (!rt.bossActive) {
      target = rt.monsters.find((m) => m.state === 'alive' && !m.targeted);
    }
    if (target || rt.bossActive) {
      rt.lastAttackBeat = beat;
      const to: Vec3 = target ? target.pos : BOSS_POSITION;
      rt.heroAttackAt = t;
      rt.heroAim = to;
      if (target) target.targeted = true;
      rt.projectiles.push({
        id: rt.nextId++,
        kind: opts.hero.attack,
        from: [...rt.heroHand] as Vec3,
        to,
        bornAt: t,
        duration: PROJECTILE_DURATION[opts.hero.attack],
        targetId: target ? target.id : -1,
      });
    }
  } else if (!rt.bossActive) {
    const next = rt.monsters.find((m) => m.state === 'alive');
    rt.heroAim = next ? next.pos : rt.heroAim;
  } else {
    rt.heroAim = BOSS_POSITION;
  }

  // --- projectile resolution ---
  for (let i = rt.projectiles.length - 1; i >= 0; i--) {
    const p = rt.projectiles[i];
    if (t - p.bornAt < p.duration) continue;
    rt.projectiles.splice(i, 1);
    if (p.targetId === -1) {
      rt.bossHitAt = t;
      rt.events.push({ type: 'bossHit', pos: p.to });
      rt.shake = Math.max(rt.shake, 0.35);
      continue;
    }
    const m = rt.monsters.find((mm) => mm.id === p.targetId);
    if (!m || m.state === 'dying') continue;
    if (p.kind === 'web' && m.state !== 'cocooned') {
      m.state = 'cocooned';
      m.stateAt = t;
      rt.events.push({ type: 'hit', pos: m.pos, color: '#ffffff' });
    } else {
      m.state = 'dying';
      m.stateAt = t;
      rt.kills++;
      rt.events.push({ type: 'pop', pos: m.pos, color: p.kind === 'beam' ? '#8ff7ff' : '#b7ff5a' });
    }
  }
  // keep the projectile list bounded in case of a long pause
  if (rt.projectiles.length > 12) rt.projectiles.splice(0, rt.projectiles.length - 12);
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
    targeted: false,
  });
  return true;
}

export function toothById(index: number) {
  return TEETH[index];
}
