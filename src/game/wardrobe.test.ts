import { describe, expect, it } from 'vitest';
import { HEROES } from '../heroes';
import { ACCESSORIES, BRUSHES, COLORS, dressHero, isMet, newlyUnlocked, nextUnlock } from './wardrobe';

const zero = { totalStars: 0, bestStreak: 0 };

describe('wardrobe', () => {
  it('starts with exactly one free item per category', () => {
    expect(BRUSHES.filter((b) => isMet(b.req, zero)).map((b) => b.id)).toEqual(['hero']);
    expect(COLORS.filter((c) => isMet(c.req, zero))).toEqual([]);
    expect(ACCESSORIES.filter((a) => isMet(a.req, zero)).map((a) => a.id)).toEqual(['none']);
  });

  it('has unique ids per category', () => {
    for (const list of [BRUSHES, COLORS, ACCESSORIES]) {
      const ids = list.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('reports items crossed by a session', () => {
    const got = newlyUnlocked({ totalStars: 2, bestStreak: 1 }, { totalStars: 4, bestStreak: 2 });
    expect(got).toEqual([
      { category: 'brush', id: 'mint' },
      { category: 'accessory', id: 'shades' },
      { category: 'accessory', id: 'crown' },
    ]);
    expect(newlyUnlocked({ totalStars: 4, bestStreak: 2 }, { totalStars: 4, bestStreak: 2 })).toEqual([]);
  });

  it('points at the closest next milestone', () => {
    expect(nextUnlock(zero)).toMatchObject({ category: 'brush', id: 'mint' });
    expect(nextUnlock({ totalStars: 999, bestStreak: 999 })).toBeNull();
  });

  it('dresses the hero with unlocked picks only', () => {
    const hero = HEROES[0];
    const look = { brush: 'galaxy', colors: 'ocean', accessory: 'crown' };
    const locked = dressHero(hero, undefined, look, zero);
    expect(locked.palette).toEqual(hero.suits[0].palette);
    expect(locked.accessory).toBeUndefined();
    const rich = dressHero(hero, undefined, look, { totalStars: 50, bestStreak: 0 });
    expect(rich.palette.primary).toBe('#1f6fd1');
    expect(rich.palette.brush).toBe('#3a1f6e');
    expect(rich.palette.brushGlow).toBe(true);
    expect(rich.accessory).toBe('crown');
    expect(rich.id).toBe(hero.suits[0].id);
  });
});
