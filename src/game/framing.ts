/**
 * Pure camera framing helpers: the vertical FOV rule used by the CameraRig, a
 * look-at projection to normalised device coordinates and the on-screen "safe
 * area" (clear of the HUD bar at the top and the big clock at the bottom).
 * The choreography tests use these to prove that the brush head and the hero
 * are on screen at every stop.
 */
import { type CameraPose, type ToothDef, type Vec3, TEETH, cross, dot, norm, sub } from './mouth';

export const HFOV_DEG = 52;
export const MIN_VFOV_DEG = 42;
export const MAX_VFOV_DEG = 85;

/** Vertical FOV (degrees) that keeps the horizontal FOV ~constant across aspect ratios. */
export function verticalFov(aspect: number): number {
  const v = (2 * Math.atan(Math.tan((HFOV_DEG * Math.PI) / 360) / Math.max(0.1, aspect)) * 180) / Math.PI;
  return Math.max(MIN_VFOV_DEG, Math.min(MAX_VFOV_DEG, v));
}

export interface SafeBox {
  xMax: number;
  yMin: number;
  yMax: number;
}

/** NDC box clear of the HUD: |x| < 0.7, below the top bar, above the clock. */
export const SAFE_BOX: SafeBox = { xMax: 0.7, yMin: -0.5, yMax: 0.62 };

export interface Ndc {
  x: number;
  y: number;
  /** View-space depth (positive in front of the camera). */
  depth: number;
}

/** Projects a world point through a look-at camera; null when behind the camera. */
export function projectToNdc(p: Vec3, pose: CameraPose, aspect: number): Ndc | null {
  const forward = norm(sub(pose.target, pose.pos));
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const d = sub(p, pose.pos);
  const depth = dot(d, forward);
  if (depth <= 0.05) return null;
  const f = 1 / Math.tan((verticalFov(aspect) * Math.PI) / 360);
  return { x: (dot(d, right) * f) / (depth * aspect), y: (dot(d, up) * f) / depth, depth };
}

export function inSafeArea(ndc: Ndc | null, box: SafeBox = SAFE_BOX): boolean {
  return !!ndc && Math.abs(ndc.x) < box.xMax && ndc.y > box.yMin && ndc.y < box.yMax;
}

/** Bounding-sphere radius used for occlusion tests of a tooth. */
export function toothRadius(t: ToothDef): number {
  return Math.max(t.size[0], t.size[1], t.size[2]) * 0.5;
}

/** True when the segment a→b passes through the sphere (centre c, radius r). */
export function segmentHitsSphere(a: Vec3, b: Vec3, c: Vec3, r: number): boolean {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  if (len2 < 1e-9) return false;
  const t = Math.max(0, Math.min(1, dot(sub(c, a), ab) / len2));
  const closest: Vec3 = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
  const d = sub(c, closest);
  return dot(d, d) < r * r;
}

/** Is the straight line from the camera to `point` blocked by a tooth other than those in `ignore`? */
export function occludedByTeeth(camPos: Vec3, point: Vec3, ignore: readonly number[] = [], teeth: readonly ToothDef[] = TEETH): boolean {
  for (const t of teeth) {
    if (ignore.includes(t.index)) continue;
    if (segmentHitsSphere(camPos, point, t.pos, toothRadius(t) * 0.85)) return true;
  }
  return false;
}
