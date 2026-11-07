import { describe, expect, it } from 'vitest';
import { TEETH, perchOn, teethForZone, zonesForTooth } from './mouth';

describe('mouth layout', () => {
  it('has 24 teeth, 12 per row, left to right', () => {
    expect(TEETH).toHaveLength(24);
    const upper = TEETH.filter((t) => t.row === 'upper');
    expect(upper).toHaveLength(12);
    for (let i = 1; i < upper.length; i++) expect(upper[i].pos[0]).toBeGreaterThan(upper[i - 1].pos[0]);
    expect(upper[0].kind).toBe('molar');
    expect(upper[5].kind).toBe('incisor');
  });

  it('assigns the right teeth to each zone', () => {
    expect(teethForZone(0).every((t) => t.row === 'upper' && t.col < 6)).toBe(true);
    expect(teethForZone(3).every((t) => t.row === 'lower' && t.col >= 6)).toBe(true);
    expect(teethForZone(4)).toHaveLength(12);
    expect(teethForZone(5).every((t) => t.row === 'lower')).toBe(true);
  });

  it('maps each tooth to its outside and inside zones', () => {
    const t = TEETH.find((x) => x.row === 'lower' && x.col === 8)!;
    expect(zonesForTooth(t)).toEqual({ outside: 3, inside: 5 });
  });

  it('perches monsters outside the tooth along its outward normal', () => {
    const t = TEETH[0];
    const p = perchOn(t, 'outside');
    const dx = p.pos[0] - t.pos[0];
    const dz = p.pos[2] - t.pos[2];
    expect(dx * t.outward[0] + dz * t.outward[2]).toBeGreaterThan(0);
    const chew = perchOn(t, 'chewing');
    expect(chew.pos[1]).toBeLessThan(t.pos[1]); // upper teeth chew downwards
  });
});
