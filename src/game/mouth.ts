/**
 * Pure geometry of "Mouth City": where every tooth sits, which teeth belong to
 * which zone, where monsters can perch and where the camera should stand.
 * No three.js dependency so it stays unit-testable.
 */
import { ZONES, type Zone } from './zones';

export type Vec3 = [number, number, number];

export const ARCH_RX = 3.1; // half-width of the dental arch
export const ARCH_RZ = 2.7; // depth of the dental arch (front at +z)
export const UPPER_GUM_Y = 1.15;
export const LOWER_GUM_Y = -1.15;
export const TEETH_PER_ROW = 12;

export type ToothKind = 'molar' | 'premolar' | 'canine' | 'incisor';

export interface ToothDef {
  /** 0..23: upper row first (left to right), then lower row. */
  index: number;
  row: 'upper' | 'lower';
  /** 0..11 left to right. */
  col: number;
  kind: ToothKind;
  /** Centre of the tooth. */
  pos: Vec3;
  /** Unit vector pointing out of the mouth (through the cheek/lip side). */
  outward: Vec3;
  /** Width, height, depth. */
  size: Vec3;
  angle: number;
}

function kindForCol(col: number): ToothKind {
  const c = col < 6 ? col : 11 - col; // 0 (back) .. 5 (front)
  if (c <= 1) return 'molar';
  if (c === 2) return 'premolar';
  if (c === 3) return 'canine';
  return 'incisor';
}

const SIZES: Record<ToothKind, Vec3> = {
  molar: [0.82, 0.78, 0.8],
  premolar: [0.62, 0.84, 0.66],
  canine: [0.5, 0.98, 0.56],
  incisor: [0.54, 0.96, 0.4],
};

function buildTeeth(): ToothDef[] {
  const out: ToothDef[] = [];
  const span = 184; // degrees covered by the arch
  for (const row of ['upper', 'lower'] as const) {
    for (let col = 0; col < TEETH_PER_ROW; col++) {
      const angle = -span / 2 + ((col + 0.5) * span) / TEETH_PER_ROW; // -92 .. 92
      const a = (angle * Math.PI) / 180;
      const kind = kindForCol(col);
      const size = SIZES[kind];
      const x = ARCH_RX * Math.sin(a);
      const z = ARCH_RZ * Math.cos(a);
      // outward normal of the ellipse
      const nx = Math.sin(a) / ARCH_RX;
      const nz = Math.cos(a) / ARCH_RZ;
      const nl = Math.hypot(nx, nz);
      const outward: Vec3 = [nx / nl, 0, nz / nl];
      const embed = 0.12;
      const y = row === 'upper' ? UPPER_GUM_Y - size[1] / 2 + embed : LOWER_GUM_Y + size[1] / 2 - embed;
      out.push({
        index: out.length,
        row,
        col,
        kind,
        pos: [x, y, z],
        outward,
        size,
        angle: a,
      });
    }
  }
  return out;
}

export const TEETH: readonly ToothDef[] = buildTeeth();

export function teethForZone(zone: Zone | number): ToothDef[] {
  const z = typeof zone === 'number' ? ZONES[zone] : zone;
  return TEETH.filter((t) => {
    if (t.row !== z.row) return false;
    if (z.side === 'left') return t.col < 6;
    if (z.side === 'right') return t.col >= 6;
    return true;
  });
}

/** Zone index whose "outside" cleaning applies to this tooth, and the "inside" one. */
export function zonesForTooth(t: ToothDef): { outside: number; inside: number } {
  const outside = t.row === 'upper' ? (t.col < 6 ? 0 : 1) : t.col < 6 ? 2 : 3;
  const inside = t.row === 'upper' ? 4 : 5;
  return { outside, inside };
}

export type PerchSurface = 'outside' | 'inside' | 'chewing';

export interface Perch {
  pos: Vec3;
  normal: Vec3;
}

/** Where a monster sits on a tooth for a given surface. */
export function perchOn(t: ToothDef, surface: PerchSurface, radius = 0.3): Perch {
  const [w, h, d] = t.size;
  void w;
  const [ox, , oz] = t.outward;
  if (surface === 'outside') {
    const off = d / 2 + radius * 0.8;
    return { pos: [t.pos[0] + ox * off, t.pos[1], t.pos[2] + oz * off], normal: [ox, 0, oz] };
  }
  if (surface === 'inside') {
    const off = d / 2 + radius * 0.8;
    return { pos: [t.pos[0] - ox * off, t.pos[1], t.pos[2] - oz * off], normal: [-ox, 0, -oz] };
  }
  const dir = t.row === 'upper' ? -1 : 1;
  const off = h / 2 + radius * 0.8;
  return { pos: [t.pos[0], t.pos[1] + dir * off, t.pos[2]], normal: [0, dir, 0] };
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Unit vector pointing "sideways" along the tooth surface, for a perch normal. */
export function perchSide(normal: Vec3): Vec3 {
  const ref: Vec3 = Math.abs(normal[1]) > 0.9 ? [0, 0, 1] : [0, 1, 0];
  return norm(cross(normal, ref));
}

/**
 * Where the hero hovers to scrub a monster on a perch: a little in front of the
 * surface and to the side, so the monster stays visible while being brushed.
 */
export function scrubStandoff(perch: Perch, sideSign = 1): Vec3 {
  const s = perchSide(perch.normal);
  const n = perch.normal;
  if (Math.abs(n[1]) > 0.9) {
    // chewing surface: hover beside the tooth with the hand roughly at surface
    // height (the brush arm pitches up/down towards the monster), never inside the row
    const side = 0.95 * sideSign;
    const front = 0.3;
    const y = n[1] < 0 ? perch.pos[1] - 0.95 : perch.pos[1] + 0.05;
    return [perch.pos[0] + n[0] * front + s[0] * side, y, perch.pos[2] + n[2] * front + s[2] * side];
  }
  const front = 0.45;
  const side = 0.8 * sideSign;
  const drop = -0.5; // feet below the tooth centre so the hand is at monster height
  return [perch.pos[0] + n[0] * front + s[0] * side, perch.pos[1] + s[1] * side + drop, perch.pos[2] + n[2] * front + s[2] * side];
}

/**
 * Resting spot of the hero for a zone when there is nothing to scrub: hovering
 * in the gap between the rows, just in front of the zone, so the current row
 * stays visible above (or below) it.
 */
export function zoneHome(zoneIndex: number): Vec3 {
  const z = ZONES[zoneIndex];
  const c = zoneCenter(zoneIndex);
  const up = z.row === 'upper';
  if (z.surface === 'outside') {
    const sideSign = z.side === 'left' ? -1 : 1;
    const a = (sideSign * 42 * Math.PI) / 180;
    const ox = Math.sin(a);
    const oz = Math.cos(a);
    return [c[0] + ox * 0.9, up ? c[1] - 1.5 : c[1] + 0.6, c[2] + oz * 0.9];
  }
  return up ? [0.8, -1.0, 2.6] : [0.8, 0.3, 2.6];
}

export function zoneCenter(zoneIndex: number): Vec3 {
  const teeth = teethForZone(zoneIndex);
  const c: Vec3 = [0, 0, 0];
  for (const t of teeth) {
    c[0] += t.pos[0];
    c[1] += t.pos[1];
    c[2] += t.pos[2];
  }
  const n = teeth.length || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

export interface CameraPose {
  pos: Vec3;
  target: Vec3;
}

/** Camera standing point for each zone (portrait-tuned). */
export function cameraPoseForZone(zoneIndex: number): CameraPose {
  const z = ZONES[zoneIndex];
  const up = z.row === 'upper';
  if (z.surface === 'outside') {
    const sideSign = z.side === 'left' ? -1 : 1;
    const a = (sideSign * 42 * Math.PI) / 180;
    const ox = Math.sin(a);
    const oz = Math.cos(a);
    const cx = ARCH_RX * ox * 0.9;
    const cz = ARCH_RZ * oz * 0.9;
    const ty = up ? 0.5 : -0.5;
    const dist = 5.2;
    return {
      pos: [cx + ox * dist, ty + (up ? 0.7 : -0.7), cz + oz * dist],
      target: [cx * 0.85, ty, cz * 0.85],
    };
  }
  // inside: camera in front of the open mouth, low (or high) and looking at the
  // chewing surfaces and inner faces of the whole row
  return up
    ? { pos: [0, -1.5, 5.6], target: [0, 0.9, 0.2] }
    : { pos: [0, 1.5, 5.6], target: [0, -0.9, 0.2] };
}

/** The Cavity King floats in the mouth opening, in front of the teeth. */
export const BOSS_POSITION: Vec3 = [0.45, 0.1, 3.2];

/** Boss radius for a given health 0..1 (it shrinks under the foam). */
export function bossRadius(health: number): number {
  return 0.45 + 0.65 * Math.max(0, Math.min(1, health));
}

/** Where the boss floats at game time `t` (gentle bob). */
export function bossPositionAt(t: number): Vec3 {
  return [BOSS_POSITION[0] + Math.sin(t * 1.3) * 0.15, BOSS_POSITION[1] + Math.sin(t * 2.1) * 0.12, BOSS_POSITION[2]];
}

/** Where the hero hovers to scrub the boss (to its left, slightly in front). */
export function bossStandoff(bossPos: Vec3, health: number): Vec3 {
  const r = bossRadius(health);
  return [bossPos[0] - (r + 0.75), bossPos[1] - 0.45, bossPos[2] + 0.35];
}

export const BOSS_CAMERA: CameraPose = { pos: [0, 0.4, 8.2], target: [0, 0.1, 1.5] };
export const INTRO_CAMERA: CameraPose = { pos: [0, 0.4, 9], target: [0, 0.2, 0] };
