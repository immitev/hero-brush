import { describe, expect, it } from 'vitest';
import { TEETH, dot, gumSign, surfaceCenter, surfaceNormal, tooth } from './mouth';

describe('mouth layout', () => {
  it('has 24 teeth, 12 per row, left to right, with the right kinds', () => {
    expect(TEETH).toHaveLength(24);
    const upper = TEETH.filter((t) => t.row === 'upper');
    expect(upper).toHaveLength(12);
    for (let i = 1; i < upper.length; i++) expect(upper[i].pos[0]).toBeGreaterThan(upper[i - 1].pos[0]);
    expect(upper.map((t) => t.kind)).toEqual([
      'molar', 'molar', 'premolar', 'canine', 'incisor', 'incisor', 'incisor', 'incisor', 'canine', 'premolar', 'molar', 'molar',
    ]);
    expect(tooth('lower', 3).row).toBe('lower');
    expect(tooth('lower', 3).col).toBe(3);
  });

  it('tangent runs left to right and is perpendicular to outward', () => {
    for (const t of TEETH) {
      expect(Math.abs(dot(t.tangent, t.outward))).toBeLessThan(1e-9);
      expect(dot(t.tangent, [1, 0, 0])).toBeGreaterThan(0);
    }
  });

  it('places surface centres on the right sides of the crown', () => {
    const t = tooth('upper', 5);
    const outer = surfaceCenter(t, 'outer');
    const inner = surfaceCenter(t, 'inner');
    const chew = surfaceCenter(t, 'chewing');
    expect(outer[2]).toBeGreaterThan(inner[2]); // outer face is towards the lips (+z)
    expect(chew[1]).toBeLessThan(t.pos[1]); // upper teeth chew downwards
    expect(surfaceNormal(t, 'chewing')).toEqual([0, -1, 0]);
    expect(gumSign(t)).toBe(1);
    const l = tooth('lower', 5);
    expect(surfaceCenter(l, 'chewing')[1]).toBeGreaterThan(l.pos[1]);
    expect(gumSign(l)).toBe(-1);
  });
});
