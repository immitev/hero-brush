import { describe, expect, it } from 'vitest';
import {
  SAFE_BOX,
  facesCamera,
  heroChest,
  inSafeArea,
  occludedByTeeth,
  pickStandoffSide,
  projectToNdc,
  segmentHitsSphere,
  verticalFov,
  visibleSpawnSpots,
} from './framing';
import { TEETH, cameraPoseForZone, perchOn, scrubStandoff, teethForZone, zoneHome } from './mouth';
import { ZONES } from './zones';

const PORTRAIT = 375 / 812;
const DESKTOP = 16 / 9;

describe('projection', () => {
  it('keeps the horizontal FOV constant within the vertical clamp', () => {
    expect(verticalFov(PORTRAIT)).toBe(85);
    expect(verticalFov(DESKTOP)).toBeCloseTo(42, 0);
    expect(verticalFov(1)).toBeCloseTo(52, 0);
  });

  it('projects the look-at target to the centre and points to the right/up correctly', () => {
    const pose = { pos: [0, 0, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    const c = projectToNdc([0, 0, 0], pose, 1)!;
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(0);
    expect(projectToNdc([1, 0, 0], pose, 1)!.x).toBeGreaterThan(0);
    expect(projectToNdc([0, 1, 0], pose, 1)!.y).toBeGreaterThan(0);
    expect(projectToNdc([0, 0, 11], pose, 1)).toBeNull();
    // narrower aspect pushes the same point further towards the edge
    expect(Math.abs(projectToNdc([1, 0, 0], pose, PORTRAIT)!.x)).toBeGreaterThan(Math.abs(projectToNdc([1, 0, 0], pose, DESKTOP)!.x));
  });

  it('safe area excludes the HUD bar and the clock', () => {
    expect(inSafeArea({ x: 0, y: 0, depth: 1 })).toBe(true);
    expect(inSafeArea({ x: 0.9, y: 0, depth: 1 })).toBe(false);
    expect(inSafeArea({ x: 0, y: 0.8, depth: 1 })).toBe(false);
    expect(inSafeArea({ x: 0, y: -0.6, depth: 1 })).toBe(false);
    expect(inSafeArea(null)).toBe(false);
  });
});

describe('occlusion', () => {
  it('detects a segment crossing a sphere and ignores misses', () => {
    expect(segmentHitsSphere([0, 0, 0], [0, 0, 10], [0, 0, 5], 0.5)).toBe(true);
    expect(segmentHitsSphere([0, 0, 0], [0, 0, 10], [2, 0, 5], 0.5)).toBe(false);
    expect(segmentHitsSphere([0, 0, 0], [0, 0, 1], [0, 0, 5], 0.5)).toBe(false); // beyond the end
  });

  it('a point behind a front incisor is occluded from a camera in front of the mouth', () => {
    const incisor = TEETH.find((t) => t.row === 'upper' && t.col === 5)!;
    const cam: [number, number, number] = [incisor.pos[0], incisor.pos[1], 8];
    const behind: [number, number, number] = [incisor.pos[0], incisor.pos[1], incisor.pos[2] - 1.5];
    expect(occludedByTeeth(cam, behind)).toBe(true);
    expect(occludedByTeeth(cam, behind, incisor.index)).toBe(false);
  });

  it('inner faces of front teeth do not face a camera in front of the mouth', () => {
    const incisor = TEETH.find((t) => t.row === 'upper' && t.col === 5)!;
    const cam: [number, number, number] = [0, -1, 6];
    expect(facesCamera(perchOn(incisor, 'inside'), cam)).toBe(false);
    expect(facesCamera(perchOn(incisor, 'chewing'), cam)).toBe(true);
    expect(facesCamera(perchOn(incisor, 'outside'), cam)).toBe(true);
  });
});

describe('spawn safe-area + occlusion filter', () => {
  for (const aspect of [PORTRAIT, DESKTOP]) {
    it(`every zone keeps at least three on-screen spawn spots at aspect ${aspect.toFixed(2)}`, () => {
      for (const z of ZONES) {
        const spots = visibleSpawnSpots(z.index, aspect);
        expect(spots.length, `zone ${z.id}`).toBeGreaterThanOrEqual(3);
        const pose = cameraPoseForZone(z.index, aspect);
        for (const s of spots) {
          expect(inSafeArea(projectToNdc(s.perch.pos, pose, aspect))).toBe(true);
          const side = pickStandoffSide(s.perch, pose.pos, aspect, pose);
          expect(inSafeArea(projectToNdc(heroChest(scrubStandoff(s.perch, side)), pose, aspect))).toBe(true);
        }
      }
    });

    it(`inside-zone spots and their stand-offs are unoccluded and face the camera at aspect ${aspect.toFixed(2)}`, () => {
      for (const zi of [4, 5]) {
        const pose = cameraPoseForZone(zi, aspect);
        const spots = visibleSpawnSpots(zi, aspect);
        expect(spots.length, `zone ${zi}`).toBeGreaterThanOrEqual(3);
        for (const s of spots) {
          expect(facesCamera(s.perch, pose.pos), `${zi}/${s.tooth.col}/${s.surface}`).toBe(true);
          const probe: [number, number, number] = [s.perch.pos[0] + s.perch.normal[0] * 0.2, s.perch.pos[1] + s.perch.normal[1] * 0.2, s.perch.pos[2] + s.perch.normal[2] * 0.2];
          expect(occludedByTeeth(pose.pos, probe, s.tooth.index), `${zi}/${s.tooth.col}/${s.surface} perch`).toBe(false);
          const side = pickStandoffSide(s.perch, pose.pos, aspect, pose);
          expect(occludedByTeeth(pose.pos, heroChest(scrubStandoff(s.perch, side))), `${zi}/${s.tooth.col}/${s.surface} hero`).toBe(false);
        }
      }
    });

    it(`the inside-zone sight line passes between the front teeth, not through them, at aspect ${aspect.toFixed(2)}`, () => {
      for (const zi of [4, 5]) {
        const pose = cameraPoseForZone(zi, aspect);
        expect(occludedByTeeth(pose.pos, pose.target)).toBe(false);
      }
    });

    it(`the hero's resting spot is on screen in every zone at aspect ${aspect.toFixed(2)}`, () => {
      for (const z of ZONES) {
        const ndc = projectToNdc(zoneHome(z.index), cameraPoseForZone(z.index, aspect), aspect);
        expect(ndc, z.id).not.toBeNull();
        expect(Math.abs(ndc!.x), z.id).toBeLessThan(0.9);
        expect(ndc!.y, z.id).toBeGreaterThan(-0.9);
        expect(ndc!.y, z.id).toBeLessThan(SAFE_BOX.yMax);
      }
    });
  }

  it('portrait filters out teeth that desktop keeps (far ends of the row)', () => {
    const p = visibleSpawnSpots(0, PORTRAIT).length;
    const d = visibleSpawnSpots(0, DESKTOP).length;
    expect(p).toBeLessThanOrEqual(d);
    const all = teethForZone(0).length;
    expect(p).toBeLessThan(all);
  });

  it('puts the brush arm on the camera side of the monster', () => {
    const pose = cameraPoseForZone(0);
    const tooth = teethForZone(0)[3];
    const perch = perchOn(tooth, 'outside');
    const side = pickStandoffSide(perch, pose.pos, DESKTOP, pose);
    const s = scrubStandoff(perch, side);
    const fx = perch.pos[0] - s[0];
    const fz = perch.pos[2] - s[2];
    const l = Math.hypot(fx, fz);
    const right = [fz / l, 0, -fx / l];
    const toCam = [pose.pos[0] - s[0], 0, pose.pos[2] - s[2]];
    const tl = Math.hypot(toCam[0], toCam[2]);
    expect(right[0] * (toCam[0] / tl) + right[2] * (toCam[2] / tl)).toBeGreaterThan(0);
  });
});
