/**
 * Pure geometry of the giant mouth: where every tooth sits, its size and
 * orientation, the tongue, and a few shared camera poses. No three.js
 * dependency so it stays unit-testable.
 */
export type Vec3 = [number, number, number];

export const ARCH_RX = 3.1; // half-width of the dental arch
export const ARCH_RZ = 2.7; // depth of the dental arch (front at +z)
export const UPPER_GUM_Y = 1.15;
/** The jaw is wide open ("open wide!") so the camera can look between the rows. */
export const LOWER_GUM_Y = -1.9;
/** Vertical centre of the gap between the two rows. */
export const GAP_CENTER_Y = (UPPER_GUM_Y + LOWER_GUM_Y) / 2; // -0.375
export const TEETH_PER_ROW = 12;

/** Tongue ellipsoid (centre + half extents); its top surface is where the tongue is brushed. */
export const TONGUE_CENTER: Vec3 = [0, LOWER_GUM_Y - 0.3, -0.8];
export const TONGUE_HALF: Vec3 = [1.9, 0.5, 2.4];
export const TONGUE_TOP_Y = TONGUE_CENTER[1] + TONGUE_HALF[1];

/** Heroes are built ~1.8 tall; this is their scale in the arena. */
export const HERO_SCALE = 0.5;
/** Right shoulder of a hero, in hero-local units (before HERO_SCALE). */
export const HERO_SHOULDER_LOCAL: Vec3 = [0.36, 0.98, 0];
/** Reach of the arm from the shoulder to the palm, in hero-local units. */
export const HERO_ARM_REACH = 0.62;

export type ToothKind = 'molar' | 'premolar' | 'canine' | 'incisor';
export type ToothRow = 'upper' | 'lower';

export interface ToothDef {
  /** 0..23: upper row first (left to right), then lower row. */
  index: number;
  row: ToothRow;
  /** 0..11 left to right (0 and 11 are the back molars). */
  col: number;
  kind: ToothKind;
  /** Centre of the crown. */
  pos: Vec3;
  /** Unit vector pointing out of the mouth (through the cheek/lip side). */
  outward: Vec3;
  /** Unit vector along the row, from left to right. */
  tangent: Vec3;
  /** Width (along the row), height, depth (outer to inner). */
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
  molar: [0.76, 0.78, 0.8],
  premolar: [0.62, 0.84, 0.66],
  canine: [0.5, 0.98, 0.56],
  incisor: [0.54, 0.96, 0.4],
};

/** Arch half-span in radians: the back molars end here. */
const HALF_SPAN = (86 * Math.PI) / 180;

/** Arc length along the arch ellipse from the midline (a = 0) to parameter a >= 0. */
function arcLength(a: number): number {
  const n = 400;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const m = ((i + 0.5) / n) * a;
    s += Math.hypot(ARCH_RX * Math.cos(m), ARCH_RZ * Math.sin(m));
  }
  return (s * a) / n;
}

/** Inverse of arcLength (bisection). */
function angleAtArc(s: number): number {
  let lo = 0;
  let hi = Math.PI;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (arcLength(mid) < s) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function baseSize(col: number): Vec3 {
  const size = SIZES[kindForCol(col)];
  // central incisors are a little bigger than laterals
  return col === 5 || col === 6 ? [size[0] * 1.1, size[1] * 1.04, size[2]] : size;
}

/**
 * Teeth sit side by side along the arch like real ones: each tooth gets an
 * arc-length slot equal to its width, so neighbours touch (no gaps), and the
 * widths are scaled so the row exactly fills the arch.
 */
function rowLayout(): { angle: number; widthScale: number }[] {
  const half = TEETH_PER_ROW / 2;
  const widths = Array.from({ length: half }, (_, i) => baseSize(half + i)[0]); // midline -> back
  const total = widths.reduce((a, b) => a + b, 0);
  const widthScale = arcLength(HALF_SPAN) / total;
  const right: number[] = [];
  let s = 0;
  for (const w of widths) {
    right.push(angleAtArc(s + (w * widthScale) / 2));
    s += w * widthScale;
  }
  const angles = [...right.map((a) => -a).reverse(), ...right];
  return angles.map((angle) => ({ angle, widthScale }));
}

function buildTeeth(): ToothDef[] {
  const out: ToothDef[] = [];
  const layout = rowLayout();
  for (const row of ['upper', 'lower'] as const) {
    for (let col = 0; col < TEETH_PER_ROW; col++) {
      const a = layout[col].angle;
      const kind = kindForCol(col);
      const b = baseSize(col);
      const sz: Vec3 = [b[0] * layout[col].widthScale, b[1], b[2]];
      const x = ARCH_RX * Math.sin(a);
      const z = ARCH_RZ * Math.cos(a);
      const nx = Math.sin(a) / ARCH_RX;
      const nz = Math.cos(a) / ARCH_RZ;
      const nl = Math.hypot(nx, nz);
      const outward: Vec3 = [nx / nl, 0, nz / nl];
      const tangent: Vec3 = [outward[2], 0, -outward[0]]; // left → right along the arch
      const embed = 0.12;
      const y = row === 'upper' ? UPPER_GUM_Y - sz[1] / 2 + embed : LOWER_GUM_Y + sz[1] / 2 - embed;
      out.push({ index: out.length, row, col, kind, pos: [x, y, z], outward, tangent, size: sz, angle: a });
    }
  }
  return out;
}

export const TEETH: readonly ToothDef[] = buildTeeth();

export function tooth(row: ToothRow, col: number): ToothDef {
  return TEETH[(row === 'upper' ? 0 : TEETH_PER_ROW) + col];
}

/** +1 for the upper row (gum is above the crown), -1 for the lower row. */
export function gumSign(t: ToothDef): 1 | -1 {
  return t.row === 'upper' ? 1 : -1;
}

/** Point on a tooth surface (centre of that face). */
export function surfaceCenter(t: ToothDef, surface: 'outer' | 'inner' | 'chewing'): Vec3 {
  const [, h, d] = t.size;
  if (surface === 'outer') return add(t.pos, scale(t.outward, d / 2));
  if (surface === 'inner') return add(t.pos, scale(t.outward, -d / 2));
  return [t.pos[0], t.pos[1] - gumSign(t) * (h / 2), t.pos[2]];
}

/** Outward unit normal of a tooth surface. */
export function surfaceNormal(t: ToothDef, surface: 'outer' | 'inner' | 'chewing'): Vec3 {
  if (surface === 'outer') return t.outward;
  if (surface === 'inner') return scale(t.outward, -1);
  return [0, -gumSign(t), 0];
}

// ---------------------------------------------------------------- vectors

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function length(a: Vec3): number {
  return Math.hypot(a[0], a[1], a[2]);
}
export function norm(a: Vec3): Vec3 {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function lerp3(a: Vec3, b: Vec3, k: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
export function dist(a: Vec3, b: Vec3): number {
  return length(sub(a, b));
}

// ---------------------------------------------------------------- cameras

export interface CameraPose {
  pos: Vec3;
  target: Vec3;
}

export const DEFAULT_ASPECT = 16 / 9;

/** Countdown: the whole mouth, hero centre stage. */
export const INTRO_CAMERA: CameraPose = { pos: [0, GAP_CENTER_Y + 0.5, 9], target: [0, GAP_CENTER_Y + 0.2, 0] };
/** Victory: slightly closer, still the whole smile. */
export const VICTORY_CAMERA: CameraPose = { pos: [0, GAP_CENTER_Y + 0.4, 8.2], target: [0, GAP_CENTER_Y + 0.1, 1.5] };
