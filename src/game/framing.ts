/**
 * Pure camera framing helpers: the vertical FOV rule used by the CameraRig, a
 * look-at projection to normalised device coordinates, and the on-screen
 * "safe area" (clear of the HUD bar at the top and the big clock at the
 * bottom) that spawns and scrub stand-offs must fall inside.
 */
import { type CameraPose, type Perch, type PerchSurface, type ToothDef, type Vec3, cameraPoseForZone, perchOn, scrubStandoff, teethForZone } from './mouth';
import { ZONES } from './zones';

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

/** NDC box clear of the HUD: |x| < 0.65, below the top bar, above the clock. */
export const SAFE_BOX: SafeBox = { xMax: 0.65, yMin: -0.45, yMax: 0.62 };

export interface Ndc {
  x: number;
  y: number;
  /** View-space depth (positive in front of the camera). */
  depth: number;
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
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

export interface SpawnSpot {
  tooth: ToothDef;
  surface: PerchSurface;
  perch: Perch;
}

/**
 * All (tooth, surface) spots of a zone whose perch AND scrub stand-offs are
 * inside the safe area for that zone's camera pose at the given aspect.
 */
export function visibleSpawnSpots(zoneIndex: number, aspect: number, box: SafeBox = SAFE_BOX): SpawnSpot[] {
  const zone = ZONES[zoneIndex];
  const pose = cameraPoseForZone(zoneIndex);
  const surfaces: PerchSurface[] = zone.surface === 'outside' ? ['outside'] : ['chewing', 'inside'];
  const out: SpawnSpot[] = [];
  for (const tooth of teethForZone(zoneIndex)) {
    for (const surface of surfaces) {
      const perch = perchOn(tooth, surface);
      if (!inSafeArea(projectToNdc(perch.pos, pose, aspect), box)) continue;
      // the hero stands beside the monster; at least one side must be on screen too
      const a = scrubStandoff(perch, 1);
      const b = scrubStandoff(perch, -1);
      const aOk = inSafeArea(projectToNdc(a, pose, aspect), box);
      const bOk = inSafeArea(projectToNdc(b, pose, aspect), box);
      if (!aOk && !bOk) continue;
      out.push({ tooth, surface, perch });
    }
  }
  return out;
}

/**
 * Picks the stand-off side (+1 / -1) so that the hero's brush arm (right arm)
 * ends up on the camera side of the monster: when the hero faces the monster,
 * its right-hand direction should point towards the camera.
 */
export function pickStandoffSide(perch: Perch, camPos: Vec3, aspect: number, pose: CameraPose, box: SafeBox = SAFE_BOX): 1 | -1 {
  const score = (side: 1 | -1): number => {
    const s = scrubStandoff(perch, side);
    const f = norm([perch.pos[0] - s[0], 0, perch.pos[2] - s[2]]);
    const rightDir: Vec3 = [f[2], 0, -f[0]];
    const toCam = norm(sub(camPos, s));
    const visible = inSafeArea(projectToNdc(s, pose, aspect), box) ? 1 : -10;
    return dot(rightDir, toCam) + visible;
  };
  return score(1) >= score(-1) ? 1 : -1;
}
