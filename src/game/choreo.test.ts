import { describe, expect, it } from 'vitest';
import { BRUSH, FLICK_HZ, SCRUB_HZ, STOPS, TONGUE_HZ, TRAVEL_SECONDS, brushPoseAt, cameraForStop, gripPoint, heroPoseFor, heroSpotFor, stopAt, stopsForSegment } from './choreo';
import { inSafeArea, occludedByTeeth, projectToNdc, verticalFov } from './framing';
import { HERO_ARM_REACH, HERO_SCALE, TEETH, type Vec3, dot, norm, sub } from './mouth';
import { SEGMENTS, SESSION_SECONDS } from './segments';

const PORTRAIT = 375 / 812;
const DESKTOP = 16 / 9;
const deg = (a: Vec3, b: Vec3) => (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * 180) / Math.PI;

describe('choreography stops', () => {
  it('tile every segment contiguously and visit every tooth surface', () => {
    for (const seg of SEGMENTS) {
      const stops = stopsForSegment(seg.index);
      expect(stops.length).toBeGreaterThan(0);
      let t = seg.start;
      for (const s of stops) {
        expect(s.start).toBeCloseTo(t);
        expect(s.seconds).toBeGreaterThanOrEqual(1.8);
        t += s.seconds;
      }
      expect(t).toBeCloseTo(seg.start + seg.seconds);
      if (seg.surface !== 'tongue') {
        const covered = new Set(stops.flatMap((s) => s.teeth));
        const rows = seg.row === 'both' ? ['upper', 'lower'] : [seg.row];
        const expected = TEETH.filter((tt) => rows.includes(tt.row) && seg.cols.includes(tt.col)).map((tt) => tt.index);
        expect([...covered].sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b));
      }
    }
    expect(stopAt(SESSION_SECONDS).surface).toBe('tongue');
  });

  it('group back teeth first and go towards the front on the outer segments', () => {
    const s = stopsForSegment(0); // upper outer left
    expect(s[0].teeth.map((i) => TEETH[i].col)).toEqual([0, 1]);
    expect(s[s.length - 1].teeth.map((i) => TEETH[i].col)).toEqual([4, 5]);
  });
});

describe('brush technique', () => {
  it('outer surfaces: bristles at 45° towards the gum, small circles, then a sweep away from the gum', () => {
    const stop = stopsForSegment(0)[1];
    const mid = brushPoseAt(stop.start + 1.0);
    expect(mid.motion).toBe('circles');
    expect(mid.contact).toBe(true);
    expect(deg(mid.bristle, [0, 1, 0])).toBeCloseTo(45, 0); // towards the (upper) gum
    expect(deg(mid.bristle, norm(sub([0, 0, 0], stop.normal)))).toBeCloseTo(45, 0); // and into the tooth
    // a small circle: positions over one period stay within ~0.12 of the centre
    const centre = brushPoseAt(stop.start + 1.0).pos;
    let maxR = 0;
    for (let u = 1.0; u < 1.5; u += 0.05) maxR = Math.max(maxR, Math.hypot(...sub(brushPoseAt(stop.start + u).pos, centre)));
    expect(maxR).toBeGreaterThan(0.08);
    expect(maxR).toBeLessThan(0.26);
    // the finishing sweep moves away from the gum and rolls the bristles flat
    const end = brushPoseAt(stop.start + stop.seconds - 0.01);
    expect(end.pos[1]).toBeLessThan(mid.pos[1] - 0.2);
    expect(deg(end.bristle, norm(sub([0, 0, 0], stop.normal)))).toBeLessThan(10);
  });

  it('inner front teeth: vertical brush, flicking away from the gum', () => {
    const upper = stopsForSegment(5)[0];
    const cycle = 1 / FLICK_HZ;
    const u0 = cycle + 0.01; // start of a flick (after the travel-in)
    const p0 = brushPoseAt(upper.start + u0);
    expect(p0.motion).toBe('flick');
    expect(Math.abs(p0.axis[1])).toBeGreaterThan(0.95); // handle vertical
    expect(dot(p0.bristle, upper.normal)).toBeLessThan(-0.9); // bristles straight onto the inner surface
    const later = brushPoseAt(upper.start + u0 + cycle * 0.4);
    expect(later.pos[1]).toBeLessThan(p0.pos[1] - 0.15); // upper: sweeps downwards, away from the gum
    const lower = stopsForSegment(7)[0];
    const l0 = brushPoseAt(lower.start + u0);
    const l1 = brushPoseAt(lower.start + u0 + cycle * 0.4);
    expect(l1.pos[1]).toBeGreaterThan(l0.pos[1] + 0.15); // lower: sweeps upwards
  });

  it('chewing surfaces: brush flat, short back-and-forth along the row', () => {
    const stop = stopsForSegment(8)[0];
    const p = brushPoseAt(stop.start + 1.0);
    expect(p.motion).toBe('scrub');
    expect(deg(p.bristle, norm(sub([0, 0, 0], stop.normal)))).toBeLessThan(1);
    expect(Math.abs(dot(p.axis, [0, 1, 0]))).toBeLessThan(0.05); // handle horizontal
    const peak = stop.start + 1.0 + 0.25 / SCRUB_HZ;
    const a = brushPoseAt(peak).pos;
    const b = brushPoseAt(peak + 0.5 / SCRUB_HZ).pos; // half a cycle later: the opposite extreme
    const along = Math.abs(dot(sub(b, a), stop.tangent));
    expect(along).toBeGreaterThan(0.25);
    expect(along).toBeLessThan(0.7);
    expect(Math.abs(b[1] - a[1])).toBeLessThan(0.01);
  });

  it('tongue: flat strokes from back to front, lifting on the return', () => {
    const stop = stopsForSegment(9)[1];
    const cycle = 1 / TONGUE_HZ; // 1.25 s
    const a = brushPoseAt(stop.start + cycle + 0.05);
    const b = brushPoseAt(stop.start + cycle + 0.5);
    expect(a.motion).toBe('tongue');
    expect(a.bristle).toEqual([0, -1, 0]);
    expect(b.pos[2]).toBeGreaterThan(a.pos[2] + 0.2); // towards the front (+z)
    expect(a.contact && b.contact).toBe(true);
    const back = brushPoseAt(stop.start + cycle + cycle * 0.85); // in the return part of the cycle
    expect(back.contact).toBe(false);
  });

  it('lifts off while travelling between stops', () => {
    const s1 = stopsForSegment(0)[1];
    const travelling = brushPoseAt(s1.start + 0.2);
    expect(travelling.contact).toBe(false);
  });
});

describe('framing of the demo', () => {
  for (const aspect of [PORTRAIT, DESKTOP]) {
    it(`brush head and hero are on screen, unoccluded, and the hero is not in front of the brush (aspect ${aspect.toFixed(2)})`, () => {
      for (const s of STOPS) {
        const label = `seg ${s.segment} stop ${s.index}`;
        const cam = cameraForStop(s, aspect);
        const head = brushPoseAt(s.start + Math.min(1.0, s.seconds * 0.5)).pos;
        expect(inSafeArea(projectToNdc(head, cam, aspect)), `${label} head`).toBe(true);
        expect(inSafeArea(projectToNdc(s.point, cam, aspect)), `${label} point`).toBe(true);
        const hero = heroSpotFor(s);
        const chest: [number, number, number] = [hero[0], hero[1] + 0.8 * HERO_SCALE, hero[2]];
        expect(inSafeArea(projectToNdc(chest, cam, aspect), { xMax: 0.9, yMin: -0.8, yMax: 0.8 }), `${label} hero`).toBe(true);
        expect(occludedByTeeth(cam.pos, head, s.teeth), `${label} head occluded`).toBe(false);
        // the hero's body (radius ~0.3 around the chest) must not cover the brush head on screen
        const headNdc = projectToNdc(head, cam, aspect)!;
        const chestNdc = projectToNdc(chest, cam, aspect)!;
        if (chestNdc.depth < headNdc.depth) {
          const dx = Math.abs(headNdc.x - chestNdc.x) * aspect; // in vertical-NDC units
          const dy = Math.abs(headNdc.y - chestNdc.y);
          const bodyRadiusNdc = (0.3 / Math.tan((verticalFov(aspect) * Math.PI) / 360)) / chestNdc.depth;
          expect(Math.hypot(dx, dy), `${label} hero covers brush`).toBeGreaterThan(bodyRadiusNdc);
        }
      }
    });
  }

  it('the hero never has to move far within a stop to keep holding the grip', () => {
    for (const s of STOPS) {
      const spots: [number, number, number][] = [];
      for (let u = TRAVEL_SECONDS; u < s.seconds; u += 0.1) spots.push(heroPoseFor(s, brushPoseAt(s.start + u)).pos);
      let maxD = 0;
      for (const a of spots) for (const b of spots) maxD = Math.max(maxD, Math.hypot(...sub(a, b)));
      expect(maxD, `seg ${s.segment} stop ${s.index}`).toBeLessThan(1.3);
      const grip = gripPoint(brushPoseAt(s.start + s.seconds / 2));
      const feet = heroPoseFor(s, brushPoseAt(s.start + s.seconds / 2)).pos;
      const shoulder: [number, number, number] = [feet[0], feet[1] + 0.98 * HERO_SCALE, feet[2]];
      expect(Math.hypot(...sub(grip, shoulder))).toBeLessThan(HERO_ARM_REACH * HERO_SCALE + 0.01);
    }
    expect(BRUSH.grip).toBeGreaterThan(BRUSH.headLength / 2 + BRUSH.neckLength);
    expect(BRUSH.gripShort).toBeGreaterThan(BRUSH.headLength / 2 + BRUSH.neckLength * 0.5);
  });
});
