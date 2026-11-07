/**
 * Brushing choreography: turns the segment list into timed "stops" (2–4
 * teeth each) and gives, for any session time, the exact pose of the
 * toothbrush head (position, bristle direction, handle axis) demonstrating the
 * correct motion, plus where the hero stands and where the camera looks.
 * Pure functions; the scene only renders what this returns.
 */
import {
  type CameraPose,
  type ToothDef,
  type Vec3,
  GAP_CENTER_Y,
  HERO_ARM_REACH,
  HERO_SCALE,
  HERO_SHOULDER_LOCAL,
  TONGUE_CENTER,
  TONGUE_HALF,
  TONGUE_TOP_Y,
  add,
  cross,
  dot,
  gumSign,
  lerp3,
  norm,
  scale,
  sub,
  surfaceCenter,
  surfaceNormal,
  tooth,
} from './mouth';
import { type Motion, type Segment, type Surface, SEGMENTS, segmentIndexAt } from './segments';

/** Toothbrush dimensions (world units). Local frame: origin = head centre, +X = towards the handle, -Y = bristles. */
export const BRUSH = {
  headLength: 0.72,
  headWidth: 0.28,
  headThick: 0.12,
  bristleLen: 0.24,
  neckLength: 0.28,
  handleLength: 1.05,
  /** Distance from the head centre to the grip point along +X (normal grip). */
  grip: 1.2,
  /** Grip used when the brush is held vertically for the front teeth (keeps the hero clear of the head). */
  gripShort: 0.9,
  /** Grip near the end of the handle, used on the chewing surfaces. */
  gripLong: 1.5,
};

/** Where the hand holds the brush for a motion. */
export function gripDistance(motion: Motion): number {
  if (motion === 'flick') return BRUSH.gripShort;
  if (motion === 'scrub') return BRUSH.gripLong; // far end of the handle: keeps the hero clear of the row seen from above
  return BRUSH.grip;
}

/** Seconds spent moving the brush from one stop to the next. */
export const TRAVEL_SECONDS = 0.5;
/** Circles per second for the gumline circles. */
export const CIRCLE_HZ = 2;
/** Flicks per second for the inner front teeth. */
export const FLICK_HZ = 1.4;
/** Back-and-forth cycles per second on chewing surfaces. */
export const SCRUB_HZ = 2.5;
/** Tongue strokes per second. */
export const TONGUE_HZ = 0.8;
/** Length of the finishing sweep away from the gum, in seconds. */
export const SWEEP_SECONDS = 0.7;

export interface Stop {
  segment: number;
  index: number;
  /** Session seconds. */
  start: number;
  seconds: number;
  surface: Surface;
  motion: Motion;
  row: 'upper' | 'lower' | 'tongue';
  /** Tooth indices (TEETH) covered at this stop; empty for the tongue. */
  teeth: number[];
  /** Contact point on the surface (centre of the group). */
  point: Vec3;
  /** Unit normal pointing out of the surface. */
  normal: Vec3;
  /** Unit vector along the row (direction the brush handle lies for horizontal grips). */
  tangent: Vec3;
  /** Unit vector from the contact point towards the gumline (zero for chewing / tongue). */
  gumDir: Vec3;
  /** Horizontal unit vector pointing away from the surface, towards open space / the camera. */
  away: Vec3;
  /** Which way along `tangent` the handle (and the hero) go. */
  heroSide: 1 | -1;
  /** Horizontal unit vector from the brush grip towards the hero's shoulder (beside the brush, never between it and the camera). */
  heroDir: Vec3;
  /** Half the distance the head drifts along the row during the stop (covers the whole group). */
  driftHalf: number;
  /** Camera pose for a 16:9 view; use `cameraForStop` for other aspects. */
  camera: CameraPose;
}

/** Camera for a stop at a given aspect: narrow (portrait) views back off along the view line. */
export function cameraForStop(stop: Stop, aspect: number): CameraPose {
  let back = aspect < 1 ? 1.35 : aspect < 1.4 ? 1.15 : 1;
  // chewing cameras sit just under the lips: backing off further would put them inside the lip
  if (stop.surface === 'chewing') back = Math.min(back, 1.12);
  if (back === 1) return stop.camera;
  const d = sub(stop.camera.pos, stop.camera.target);
  return { pos: add(stop.camera.target, scale(d, back)), target: stop.camera.target };
}

const UP: Vec3 = [0, 1, 0];
const COS45 = Math.SQRT1_2;

function avg(points: Vec3[]): Vec3 {
  const c: Vec3 = [0, 0, 0];
  for (const p of points) {
    c[0] += p[0];
    c[1] += p[1];
    c[2] += p[2];
  }
  const n = points.length || 1;
  return [c[0] / n, c[1] / n, c[2] / n];
}

function groupTeeth(seg: Segment): ToothDef[][] {
  const rows: ('upper' | 'lower')[] = seg.row === 'both' ? ['lower', 'upper'] : [seg.row];
  const groups: ToothDef[][] = [];
  for (const row of rows) {
    if (seg.surface === 'chewing') {
      groups.push([0, 1, 2].map((c) => tooth(row, c)), [3, 4, 5].map((c) => tooth(row, c)), [6, 7, 8].map((c) => tooth(row, c)), [9, 10, 11].map((c) => tooth(row, c)));
      continue;
    }
    const cols = [...seg.cols];
    const left = cols.filter((c) => c < 6).sort((a, b) => a - b); // back → front
    const right = cols.filter((c) => c >= 6).sort((a, b) => b - a); // back → front
    for (const side of [left, right]) {
      for (let i = 0; i < side.length; i += 2) groups.push(side.slice(i, i + 2).map((c) => tooth(row, c)));
    }
  }
  return groups;
}

function stopForGroup(seg: Segment, teeth: ToothDef[], index: number, count: number): Stop {
  const first = teeth[0];
  const surface = seg.surface as 'outer' | 'inner' | 'chewing';
  const point = avg(teeth.map((t) => surfaceCenter(t, surface)));
  const normal = norm(avg(teeth.map((t) => surfaceNormal(t, surface))));
  let tangent = norm(avg(teeth.map((t) => t.tangent)));
  const gs = gumSign(first);
  const gumDir: Vec3 = surface === 'chewing' ? [0, 0, 0] : [0, gs, 0];
  const away: Vec3 = surface === 'chewing' ? norm([first.outward[0], 0, first.outward[2]]) : norm([normal[0], 0, normal[2]]);
  if (surface === 'chewing') tangent = norm(cross(UP, away)); // along the row, consistent with left→right
  // the hero stands on the side towards the front of the mouth for back teeth (so it never hides
  // the row still to come), and on the outer side for the front teeth
  const heroSide: 1 | -1 = first.col < 6 ? 1 : -1;
  const row = first.row;
  const up = row === 'upper';
  // how far the group extends along the row (so the head drifts across all of it)
  const along = teeth.map((t) => dot(sub(surfaceCenter(t, surface), point), tangent));
  // capped so the hero never has to run along the row; whatever the head misses is
  // finished when the stop ends (see simulation.finishStop)
  const driftHalf = Math.min(0.58, Math.max(0, (Math.max(...along) - Math.min(...along)) / 2 + 0.1));

  const side = scale(tangent, heroSide);
  // the hero stands beside the brush: mostly along the row (handle side) and only a little
  // off the surface, so it never ends up between the camera and the bristles
  const heroDir: Vec3 =
    surface === 'outer' ? norm(add(scale(side, 0.9), scale(away, 0.4))) : surface === 'inner' ? norm(add(scale(side, 0.95), scale(away, 0.15))) : norm(add(scale(away, 0.1), scale(side, 1.0)));

  const seconds = seg.seconds / count;
  const stop: Stop = {
    segment: seg.index,
    index,
    start: seg.start + index * seconds,
    seconds,
    surface: seg.surface,
    motion: seg.motion,
    row,
    teeth: teeth.map((t) => t.index),
    point,
    normal,
    tangent,
    gumDir,
    away,
    heroSide,
    heroDir,
    driftHalf,
    camera: { pos: [0, 0, 0], target: [0, 0, 0] },
  };

  // camera: frame the brush head together with the hero (target biased towards the hero's chest)
  const hero = heroSpotFor(stop);
  const chest: Vec3 = [hero[0], hero[1] + 0.8 * HERO_SCALE, hero[2]];
  // close-up of the current 2–3 teeth: the camera sits on the opposite side of the hero, offset
  // along the row so the bristle tilt is seen in profile, and a little towards the gum side
  const target = lerp3(point, chest, 0.2);
  const gumUp: Vec3 = [0, up ? 1 : -1, 0];
  if (surface === 'outer') {
    // side-on along the row so the bristle tilt into the gum reads; the handle leaves the frame diagonally
    stop.camera = {
      pos: add(add(add(point, scale(normal, 1.9)), scale(side, -2.6)), scale(gumUp, 0.35)),
      target: add(target, scale(gumUp, 0.05)),
    };
  } else if (surface === 'inner') {
    const front = first.col >= 4 && first.col <= 7;
    // inside the arch (between the rows), from the hero's opposite side
    // front: the handle (and the hero) hang a long way below/above the head during the flick, so the
    // look point is biased further towards the hero to keep both in a 16:9 frame
    stop.camera = front
      ? { pos: add(add(add(point, scale(normal, 3.3)), scale(side, -1.6)), scale(gumUp, 0.3)), target: lerp3(point, chest, 0.58) }
      : { pos: add(add(add(point, scale(normal, 1.7)), scale(side, -1.9)), scale(gumUp, -0.15)), target };
  } else {
    stop.camera = {
      // above/below the row and a little outside it: below the upper lip, above the tongue
      pos: add(add(add(point, scale(gumUp, -2.6)), scale(away, 1.4)), scale(side, -0.6)),
      target: lerp3(point, chest, 0.4),
    };
  }
  return stop;
}

function tongueStops(seg: Segment): Stop[] {
  const lanes = [-0.65, 0, 0.65];
  return lanes.map((x, i) => {
    const seconds = seg.seconds / lanes.length;
    const heroSide: 1 | -1 = i === 0 ? -1 : 1;
    const point: Vec3 = [x, TONGUE_TOP_Y - 0.12 * (x / TONGUE_HALF[0]) ** 2, TONGUE_CENTER[2] + 0.3];
    const stop: Stop = {
      segment: seg.index,
      index: i,
      start: seg.start + i * seconds,
      seconds,
      surface: 'tongue',
      motion: 'tongue',
      row: 'tongue',
      teeth: [],
      point,
      normal: UP,
      tangent: [0, 0, 1],
      gumDir: [0, 0, 0],
      away: norm([heroSide, 0, 0.35]),
      heroSide,
      heroDir: norm([heroSide, 0, 0.35]),
      driftHalf: 0,
      camera: { pos: [0, 0, 0], target: [0, 0, 0] },
    };
    const hero = heroSpotFor(stop);
    const chest: Vec3 = [hero[0], hero[1] + 0.8 * HERO_SCALE, hero[2]];
    stop.camera = { pos: [-heroSide * 0.8, GAP_CENTER_Y + 1.0, 3.9], target: lerp3([x * 0.5, TONGUE_TOP_Y + 0.1, TONGUE_CENTER[2] + 0.5], chest, 0.2) };
    return stop;
  });
}

function buildStops(): Stop[] {
  const out: Stop[] = [];
  for (const seg of SEGMENTS) {
    if (seg.surface === 'tongue') {
      out.push(...tongueStops(seg));
      continue;
    }
    const groups = groupTeeth(seg);
    groups.forEach((g, i) => out.push(stopForGroup(seg, g, i, groups.length)));
  }
  return out;
}

export const STOPS: readonly Stop[] = buildStops();

export function stopIndexAt(t: number): number {
  const seg = segmentIndexAt(t);
  let idx = 0;
  for (let i = 0; i < STOPS.length; i++) {
    if (STOPS[i].segment !== seg) continue;
    if (t >= STOPS[i].start) idx = i;
  }
  return idx;
}

export function stopAt(t: number): Stop {
  return STOPS[stopIndexAt(t)];
}

export function stopsForSegment(segment: number): Stop[] {
  return STOPS.filter((s) => s.segment === segment);
}

export interface BrushPose {
  /** Head centre. */
  pos: Vec3;
  /** Unit direction the bristles point (into the surface). */
  bristle: Vec3;
  /** Unit direction from the head towards the handle. */
  axis: Vec3;
  /** Bristles touching the surface (false while travelling / lifting). */
  contact: boolean;
  /** 0..1 within the current stroke cycle. */
  cycle: number;
  motion: Motion;
}

/** Resting pose at a stop (no motion offset), used as the travel end points. */
function basePose(s: Stop): BrushPose {
  const { normal, tangent, gumDir, heroSide, motion } = s;
  if (motion === 'circles') {
    const bristle = norm(add(scale(normal, -COS45), scale(gumDir, COS45)));
    const pos = add(add(s.point, scale(normal, BRUSH.bristleLen * COS45 + BRUSH.headThick / 2)), scale(gumDir, 0.12));
    return { pos, bristle, axis: scale(tangent, heroSide), contact: true, cycle: 0, motion };
  }
  if (motion === 'flick') {
    const pos = add(add(s.point, scale(normal, BRUSH.bristleLen + BRUSH.headThick / 2)), scale(gumDir, 0.22));
    return { pos, bristle: scale(normal, -1), axis: scale(gumDir, -1), contact: true, cycle: 0, motion };
  }
  if (motion === 'scrub') {
    const pos = add(s.point, scale(normal, BRUSH.bristleLen + BRUSH.headThick / 2));
    return { pos, bristle: scale(normal, -1), axis: scale(tangent, heroSide), contact: true, cycle: 0, motion };
  }
  // tongue: flat, handle towards the hero's side and a little forward
  const pos = add(s.point, [0, BRUSH.bristleLen + BRUSH.headThick / 2, -0.45]);
  return { pos, bristle: [0, -1, 0], axis: norm([heroSide * 0.9, 0, 0.45]), contact: true, cycle: 0, motion };
}

function frac(x: number): number {
  return x - Math.floor(x);
}

/** Tongue stroke length (back → front) in world units. */
export const TONGUE_STROKE = 0.9;

/** Slow drift along the row so the head covers the whole group during the stop. */
function drift(s: Stop, u: number): Vec3 {
  if (s.driftHalf <= 0) return [0, 0, 0];
  const k = Math.max(0, Math.min(1, (u - 0.2) / Math.max(0.1, s.seconds - SWEEP_SECONDS - 0.4)));
  // from the back of the group towards the front (the hero's side), symmetric for left and right groups
  return scale(s.tangent, s.heroSide * (-s.driftHalf + 2 * s.driftHalf * k));
}

/** Pose while brushing at a stop, `u` seconds into it. */
function motionPose(s: Stop, u: number): BrushPose {
  const base = basePose(s);
  const { normal, tangent, gumDir } = s;
  if (s.motion === 'circles') {
    const sweepStart = Math.max(s.seconds - SWEEP_SECONDS, s.seconds * 0.6);
    if (u >= sweepStart) {
      // finishing sweep away from the gum, bristles roll flat
      const k = Math.min(1, (u - sweepStart) / SWEEP_SECONDS);
      const e = k * k * (3 - 2 * k);
      const pos = add(add(base.pos, drift(s, sweepStart)), scale(gumDir, -0.45 * e));
      const bristle = norm(add(scale(normal, -(COS45 + (1 - COS45) * e)), scale(gumDir, COS45 * (1 - e))));
      return { ...base, pos, bristle, cycle: e, contact: true };
    }
    const a = u * CIRCLE_HZ * Math.PI * 2;
    const r = 0.11;
    const pos = add(add(add(base.pos, drift(s, u)), scale(tangent, Math.cos(a) * r)), scale(gumDir, Math.sin(a) * r));
    return { ...base, pos, cycle: frac(u * CIRCLE_HZ) };
  }
  if (s.motion === 'flick') {
    const c = frac(u * FLICK_HZ);
    // 70 % of the cycle sweeping from the gum to the edge, 30 % lifting back
    const k = c < 0.7 ? c / 0.7 : 1 - (c - 0.7) / 0.3;
    const lifting = c >= 0.7;
    const pos = add(add(base.pos, scale(gumDir, -0.5 * k)), scale(normal, lifting ? 0.12 : 0));
    return { ...base, pos, contact: !lifting, cycle: c };
  }
  if (s.motion === 'scrub') {
    const a = u * SCRUB_HZ * Math.PI * 2;
    const pos = add(add(base.pos, drift(s, u)), scale(tangent, Math.sin(a) * 0.22));
    return { ...base, pos, cycle: frac(u * SCRUB_HZ) };
  }
  // tongue: back → front strokes, lift on the way back
  const c = frac(u * TONGUE_HZ);
  const k = c < 0.75 ? c / 0.75 : 1 - (c - 0.75) / 0.25;
  const lifting = c >= 0.75;
  const pos = add(base.pos, [0, lifting ? 0.2 : 0, TONGUE_STROKE * k]);
  return { ...base, pos, contact: !lifting, cycle: c };
}

function smooth(k: number): number {
  const c = Math.max(0, Math.min(1, k));
  return c * c * (3 - 2 * c);
}

/** Brush pose at session time `t`, including the travel between stops. */
export function brushPoseAt(t: number): BrushPose {
  const i = stopIndexAt(t);
  const s = STOPS[i];
  const u = Math.max(0, t - s.start);
  if (i > 0 && u < TRAVEL_SECONDS) {
    const prev = STOPS[i - 1];
    const from = motionPose(prev, prev.seconds);
    const to = motionPose(s, 0);
    const k = smooth(u / TRAVEL_SECONDS);
    // lift the brush a little off the surfaces while travelling
    const lift = Math.sin(k * Math.PI) * 0.3;
    const pos = add(lerp3(from.pos, to.pos, k), scale(norm(add(from.bristle, to.bristle)), -lift));
    return { pos, bristle: norm(lerp3(from.bristle, to.bristle, k)), axis: norm(lerp3(from.axis, to.axis, k)), contact: false, cycle: 0, motion: s.motion };
  }
  return motionPose(s, u);
}

/** Where the hand holds the brush. */
export function gripPoint(p: BrushPose): Vec3 {
  return add(p.pos, scale(p.axis, gripDistance(p.motion)));
}

export interface HeroPose {
  /** Feet position. */
  pos: Vec3;
  /** Unit horizontal facing. */
  facing: Vec3;
}

/**
 * The hero stands so that its right hand can hold the grip: shoulder a little
 * behind the grip (away from the teeth), feet one shoulder-height lower.
 */
export function heroPoseFor(stop: Stop, p: BrushPose): HeroPose {
  const grip = gripPoint(p);
  const reach = HERO_ARM_REACH * HERO_SCALE * 0.75;
  // the body sits below (upper row) / above (lower row) the handle, in the gap, never over the row
  // On the flat surfaces nothing is needed, and beside the vertical handle of the inner front teeth any offset
  // along the handle would put the hero's silhouette over the neighbouring front tooth.
  const drop = stop.surface === 'chewing' || stop.surface === 'tongue' || stop.motion === 'flick' ? 0 : stop.row === 'upper' ? -0.3 : 0.3;
  const shoulder = add(add(grip, scale(stop.heroDir, reach)), [0, drop, 0]);
  const shoulderY = HERO_SHOULDER_LOCAL[1] * HERO_SCALE;
  const pos: Vec3 = [shoulder[0], shoulder[1] - shoulderY, shoulder[2]];
  const look = sub(stop.point, pos);
  const facing = norm([look[0], 0, look[2]]);
  return { pos, facing };
}

/** Points on the hero's silhouette (feet, chest, head top, shoulders) for occlusion checks. */
export function heroBoundPoints(feet: Vec3, facing: Vec3): Vec3[] {
  const h = 1.8 * HERO_SCALE;
  const w = 0.5 * HERO_SCALE;
  const right: Vec3 = [facing[2], 0, -facing[0]];
  const chest: Vec3 = [feet[0], feet[1] + h * 0.45, feet[2]];
  return [
    [feet[0], feet[1] + 0.05, feet[2]],
    chest,
    [feet[0], feet[1] + h, feet[2]],
    add(chest, scale(right, w)),
    add(chest, scale(right, -w)),
  ];
}

/** The pure "resting" hero spot for a stop (used by framing tests). */
export function heroSpotFor(stop: Stop): Vec3 {
  return heroPoseFor(stop, basePose(stop)).pos;
}

export { basePose as restingBrushPose };
