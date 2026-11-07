/**
 * Pure camera framing helpers: the vertical FOV rule used by the CameraRig, a
 * look-at projection to normalised device coordinates, the on-screen "safe
 * area" (clear of the HUD bar at the top and the big clock at the bottom), and
 * a tooth-occlusion check. Spawn spots and scrub stand-offs must be on screen,
 * facing the camera and not hidden behind other teeth.
 */
import {
  type CameraPose,
  type Perch,
  type PerchSurface,
  type ToothDef,
  type Vec3,
  DEFAULT_ASPECT,
  TEETH,
  cameraPoseForZone,
  perchOn,
  scrubStandoff,
  teethForZone,
} from './mouth';
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

/**
 * Is the straight line from the camera to `point` blocked by a tooth?
 * `ignoreTooth` is the tooth the point sits on (its own tooth never counts).
 */
export function occludedByTeeth(camPos: Vec3, point: Vec3, ignoreTooth: number = -1, teeth: readonly ToothDef[] = TEETH): boolean {
  for (const t of teeth) {
    if (t.index === ignoreTooth) continue;
    if (segmentHitsSphere(camPos, point, t.pos, toothRadius(t) * 0.9)) return true;
  }
  return false;
}

/** The perch surface must face the camera (otherwise the monster is on the far side of its tooth). */
export function facesCamera(perch: Perch, camPos: Vec3, minDot = 0.15): boolean {
  return dot(perch.normal, norm(sub(camPos, perch.pos))) > minDot;
}

/** Point used for hero occlusion tests: chest height of the (scaled) hero standing at `standoff`. */
export function heroChest(standoff: Vec3): Vec3 {
  return [standoff[0], standoff[1] + 0.55, standoff[2]];
}

export interface SpawnSpot {
  tooth: ToothDef;
  surface: PerchSurface;
  perch: Perch;
}

/** The hero counts as on screen when its chest (not its feet) is inside the safe box and unoccluded. */
function standoffVisible(perch: Perch, side: 1 | -1, pose: CameraPose, aspect: number, box: SafeBox): boolean {
  const chest = heroChest(scrubStandoff(perch, side));
  return inSafeArea(projectToNdc(chest, pose, aspect), box) && !occludedByTeeth(pose.pos, chest);
}

/**
 * All (tooth, surface) spots of a zone whose perch is inside the safe area,
 * faces the camera, is not hidden behind another tooth, and has at least one
 * scrub stand-off that is on screen and unoccluded — for that zone's camera
 * pose at the given aspect.
 */
export function visibleSpawnSpots(zoneIndex: number, aspect: number = DEFAULT_ASPECT, box: SafeBox = SAFE_BOX): SpawnSpot[] {
  const zone = ZONES[zoneIndex];
  const pose = cameraPoseForZone(zoneIndex, aspect);
  const surfaces: PerchSurface[] = zone.surface === 'outside' ? ['outside'] : ['chewing', 'inside'];
  const out: SpawnSpot[] = [];
  for (const tooth of teethForZone(zoneIndex)) {
    for (const surface of surfaces) {
      const perch = perchOn(tooth, surface);
      if (!inSafeArea(projectToNdc(perch.pos, pose, aspect), box)) continue;
      if (!facesCamera(perch, pose.pos)) continue;
      // test a point slightly off the surface so the monster's own tooth does not count
      const probe: Vec3 = [perch.pos[0] + perch.normal[0] * 0.2, perch.pos[1] + perch.normal[1] * 0.2, perch.pos[2] + perch.normal[2] * 0.2];
      if (occludedByTeeth(pose.pos, probe, tooth.index)) continue;
      if (!standoffVisible(perch, 1, pose, aspect, box) && !standoffVisible(perch, -1, pose, aspect, box)) continue;
      out.push({ tooth, surface, perch });
    }
  }
  return out;
}

/**
 * Picks the stand-off side (+1 / -1): prefer sides that are on screen and not
 * hidden behind teeth; among those, the one where the hero's brush arm (right
 * arm) ends up on the camera side of the monster.
 */
export function pickStandoffSide(perch: Perch, camPos: Vec3, aspect: number, pose: CameraPose, box: SafeBox = SAFE_BOX): 1 | -1 {
  const score = (side: 1 | -1): number => {
    const s = scrubStandoff(perch, side);
    const f = norm([perch.pos[0] - s[0], 0, perch.pos[2] - s[2]]);
    const rightDir: Vec3 = [f[2], 0, -f[0]];
    const toCam = norm(sub(camPos, s));
    const chest = heroChest(s);
    const visible = inSafeArea(projectToNdc(chest, pose, aspect), box) ? 1 : -10;
    const clear = occludedByTeeth(camPos, chest) ? -5 : 0;
    return dot(rightDir, toCam) + visible + clear;
  };
  return score(1) >= score(-1) ? 1 : -1;
}
