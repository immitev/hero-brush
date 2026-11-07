/**
 * Plaque film per tooth surface, as a small grid of cells (8 along the row ×
 * 4 from the gumline to the edge) for the outer, inner and chewing surfaces of
 * each tooth. The brush head clears the cells it passes over; the gumline
 * row only comes clean when the bristles are angled towards the gum.
 */
import type { BrushPose } from './choreo';
import { BRUSH } from './choreo';
import { type ToothDef, type Vec3, TEETH, cross, dot, gumSign, sub } from './mouth';

export const CELLS_U = 8;
export const CELLS_V = 4;
export const CELLS_PER_SURFACE = CELLS_U * CELLS_V;
export type PlaqueSurface = 'outer' | 'inner' | 'chewing';
export const SURFACES: readonly PlaqueSurface[] = ['outer', 'inner', 'chewing'];
export const CELLS_PER_TOOTH = CELLS_PER_SURFACE * SURFACES.length;
/** A surface counts as clean above this mean cleanliness. */
export const CLEAN_THRESHOLD = 0.92;
/** Cleanliness gained per second of brush contact. */
export const CLEAN_RATE = 2.2;

export interface PlaqueState {
  /** Cleanliness 0 (plaque) .. 1 (clean) per cell: tooth × surface × v × u. */
  cells: Float32Array;
  /** Set when a tooth's cells changed since the renderer last read them. */
  changed: Uint8Array;
  /** Surfaces already reported as clean (tooth*3 + surface). */
  reported: Uint8Array;
}

export function createPlaque(): PlaqueState {
  return {
    cells: new Float32Array(TEETH.length * CELLS_PER_TOOTH),
    changed: new Uint8Array(TEETH.length).fill(1),
    reported: new Uint8Array(TEETH.length * SURFACES.length),
  };
}

export function surfaceIndex(surface: PlaqueSurface): number {
  return SURFACES.indexOf(surface);
}

export function cellOffset(toothIndex: number, surface: PlaqueSurface, iu: number, iv: number): number {
  return toothIndex * CELLS_PER_TOOTH + surfaceIndex(surface) * CELLS_PER_SURFACE + iv * CELLS_U + iu;
}

/**
 * World centre of a plaque cell. u runs along the row (0 = left), v from the
 * gumline (0) to the edge (1) for wall surfaces, and from the inner side (0)
 * to the outer side (1) for chewing surfaces.
 */
export function cellCenter(t: ToothDef, surface: PlaqueSurface, iu: number, iv: number): Vec3 {
  const [w, h, d] = t.size;
  const fu = (iu + 0.5) / CELLS_U - 0.5;
  const fv = (iv + 0.5) / CELLS_V;
  const gs = gumSign(t);
  const tx = t.tangent;
  const ox = t.outward;
  if (surface === 'chewing') {
    const y = t.pos[1] - gs * (h / 2);
    const fo = fv - 0.5;
    return [t.pos[0] + tx[0] * fu * w + ox[0] * fo * d, y, t.pos[2] + tx[2] * fu * w + ox[2] * fo * d];
  }
  const side = surface === 'outer' ? 1 : -1;
  const y = t.pos[1] + gs * (h / 2) - gs * fv * h; // gum → edge
  return [t.pos[0] + tx[0] * fu * w + ox[0] * side * (d / 2), y, t.pos[2] + tx[2] * fu * w + ox[2] * side * (d / 2)];
}

export function surfaceCleanliness(p: PlaqueState, toothIndex: number, surface: PlaqueSurface): number {
  const o = cellOffset(toothIndex, surface, 0, 0);
  let s = 0;
  for (let i = 0; i < CELLS_PER_SURFACE; i++) s += p.cells[o + i];
  return s / CELLS_PER_SURFACE;
}

/** Mean cleanliness over every surface of every tooth. */
export function overallCleanliness(p: PlaqueState): number {
  let s = 0;
  for (let i = 0; i < p.cells.length; i++) s += p.cells[i];
  return s / p.cells.length;
}

export interface ContactResult {
  /** Surfaces that just crossed the clean threshold: { tooth, surface }. */
  cleaned: { tooth: number; surface: PlaqueSurface }[];
  /** Cells that received cleaning this step. */
  touched: number;
}

const MARGIN = 0.1;

/**
 * Applies `dt` seconds of brushing with the brush at `pose` to `surface` of the
 * given teeth. Cells under the head footprint (in the head's plane) get
 * cleaner; the gumline row needs the bristles angled towards the gum.
 */
export function brushContact(p: PlaqueState, pose: BrushPose, teeth: readonly number[], surface: PlaqueSurface, dt: number, rate = CLEAN_RATE): ContactResult {
  const result: ContactResult = { cleaned: [], touched: 0 };
  if (!pose.contact || dt <= 0) return result;
  const across = cross(pose.axis, pose.bristle);
  const halfL = BRUSH.headLength / 2 + MARGIN;
  const halfW = BRUSH.headWidth / 2 + MARGIN;
  for (const ti of teeth) {
    const t = TEETH[ti];
    const gum: Vec3 = [0, gumSign(t), 0];
    const angled = surface === 'chewing' || dot(pose.bristle, gum) > 0.3;
    let any = false;
    for (let iv = 0; iv < CELLS_V; iv++) {
      const cellRate = iv === 0 && !angled ? rate * 0.25 : rate; // gumline needs the 45° tilt
      for (let iu = 0; iu < CELLS_U; iu++) {
        const c = cellCenter(t, surface, iu, iv);
        const d = sub(c, pose.pos);
        const along = dot(d, pose.axis);
        const side = dot(d, across);
        const depth = dot(d, pose.bristle);
        if (Math.abs(along) > halfL || Math.abs(side) > halfW || depth < -0.15 || depth > BRUSH.bristleLen + 0.45) continue;
        const o = cellOffset(ti, surface, iu, iv);
        if (p.cells[o] >= 1) continue;
        p.cells[o] = Math.min(1, p.cells[o] + cellRate * dt);
        any = true;
        result.touched++;
      }
    }
    if (any) {
      p.changed[ti] = 1;
      const r = ti * SURFACES.length + surfaceIndex(surface);
      if (!p.reported[r] && surfaceCleanliness(p, ti, surface) >= CLEAN_THRESHOLD) {
        p.reported[r] = 1;
        result.cleaned.push({ tooth: ti, surface });
      }
    }
  }
  return result;
}

/** Forces a surface clean (used when a stop ends so no cell is left behind). Returns true if it was newly reported. */
export function finishSurface(p: PlaqueState, toothIndex: number, surface: PlaqueSurface): boolean {
  const o = cellOffset(toothIndex, surface, 0, 0);
  let changed = false;
  for (let i = 0; i < CELLS_PER_SURFACE; i++) {
    if (p.cells[o + i] < 1) {
      p.cells[o + i] = 1;
      changed = true;
    }
  }
  if (changed) p.changed[toothIndex] = 1;
  const r = toothIndex * SURFACES.length + surfaceIndex(surface);
  if (!p.reported[r]) {
    p.reported[r] = 1;
    return true;
  }
  return false;
}

/**
 * Writes a tooth's cells into an 8×12 byte image (rows 0–3 outer, 4–7 inner,
 * 8–11 chewing; 255 = clean) for the shader.
 */
export function writeToothImage(p: PlaqueState, toothIndex: number, out: Uint8Array): void {
  const base = toothIndex * CELLS_PER_TOOTH;
  for (let i = 0; i < CELLS_PER_TOOTH; i++) out[i] = Math.round(Math.max(0, Math.min(1, p.cells[base + i])) * 255);
}
