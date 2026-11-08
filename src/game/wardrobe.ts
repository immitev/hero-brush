/**
 * The wardrobe: brushes, suit colours and add-ons the child unlocks by
 * brushing. Unlocks are milestones (total stars or best day streak), never
 * spent, so the star total only ever goes up. Pure data + logic, no React.
 */
import type { AccessoryId, HeroPack, Suit } from '../heroes/types';
import { getSuit } from '../heroes';

export type WardrobeCategory = 'brush' | 'colors' | 'accessory';

/** Milestone that unlocks an item: total stars or the best day streak. */
export type Requirement = { stars: number } | { streak: number } | null;

export interface Progress {
  totalStars: number;
  bestStreak: number;
}

export interface BrushItem {
  id: string;
  req: Requirement;
  /** null = the hero's own brush colour. */
  handle: string | null;
  stripe?: string;
  bristle?: string;
  glow?: boolean;
}

export interface ColorItem {
  id: string;
  req: Requirement;
  primary: string;
  secondary: string;
  accent: string;
}

export interface AccessoryItem {
  id: 'none' | AccessoryId;
  req: Requirement;
}

export const BRUSHES: readonly BrushItem[] = [
  { id: 'hero', req: null, handle: null },
  { id: 'mint', req: { stars: 3 }, handle: '#3ddc97', bristle: '#e9fff6' },
  { id: 'ocean', req: { streak: 3 }, handle: '#2f80ed', stripe: '#8ff7ff', bristle: '#d6f3ff' },
  { id: 'rainbow', req: { stars: 8 }, handle: '#ff5c7a', stripe: '#ffd166', bristle: '#bfe9ff' },
  { id: 'galaxy', req: { stars: 15 }, handle: '#3a1f6e', stripe: '#c77dff', bristle: '#e0c3fc', glow: true },
  { id: 'gold', req: { streak: 7 }, handle: '#f2b134', stripe: '#fff2c2', glow: true },
];

export const COLORS: readonly ColorItem[] = [
  { id: 'ocean', req: { stars: 5 }, primary: '#1f6fd1', secondary: '#8ff7ff', accent: '#123d7a' },
  { id: 'candy', req: { streak: 5 }, primary: '#ff6fb5', secondary: '#ffffff', accent: '#b83280' },
  { id: 'jungle', req: { stars: 12 }, primary: '#2e9e5b', secondary: '#f2d14b', accent: '#1c5e37' },
  { id: 'lava', req: { stars: 20 }, primary: '#ff7a1a', secondary: '#2b2f3a', accent: '#a33a00' },
  { id: 'galaxy', req: { stars: 30 }, primary: '#3a1f6e', secondary: '#c77dff', accent: '#1b1340' },
];

export const ACCESSORIES: readonly AccessoryItem[] = [
  { id: 'none', req: null },
  { id: 'shades', req: { streak: 2 } },
  { id: 'crown', req: { stars: 4 } },
  { id: 'bow', req: { streak: 4 } },
  { id: 'cap', req: { stars: 10 } },
  { id: 'headphones', req: { stars: 18 } },
];

/** What the child picked for one hero (ids from the lists above). */
export interface HeroLook {
  brush?: string;
  /** A colour set; absent = the hero's own suit colours. */
  colors?: string;
  accessory?: string;
}

export function isMet(req: Requirement, p: Progress): boolean {
  if (!req) return true;
  if ('stars' in req) return p.totalStars >= req.stars;
  return p.bestStreak >= req.streak;
}

/** How far along the requirement is, for "7/10" labels. */
export function reqProgress(req: Requirement, p: Progress): { have: number; need: number; kind: 'stars' | 'streak' } | null {
  if (!req) return null;
  if ('stars' in req) return { have: Math.min(p.totalStars, req.stars), need: req.stars, kind: 'stars' };
  return { have: Math.min(p.bestStreak, req.streak), need: req.streak, kind: 'streak' };
}

export interface UnlockedItem {
  category: WardrobeCategory;
  id: string;
}

function allItems(): { category: WardrobeCategory; id: string; req: Requirement }[] {
  return [
    ...BRUSHES.map((b) => ({ category: 'brush' as const, id: b.id, req: b.req })),
    ...COLORS.map((c) => ({ category: 'colors' as const, id: c.id, req: c.req })),
    ...ACCESSORIES.map((a) => ({ category: 'accessory' as const, id: a.id, req: a.req })),
  ];
}

/** Items that became available between two progress snapshots. */
export function newlyUnlocked(before: Progress, after: Progress): UnlockedItem[] {
  return allItems()
    .filter((i) => i.req && !isMet(i.req, before) && isMet(i.req, after))
    .map(({ category, id }) => ({ category, id }));
}

/** The next locked milestone, to show what to aim for. */
export function nextUnlock(p: Progress): (UnlockedItem & { req: Requirement }) | null {
  const locked = allItems().filter((i) => !isMet(i.req, p));
  locked.sort((a, b) => remaining(a.req, p) - remaining(b.req, p));
  return locked[0] ?? null;
}

function remaining(req: Requirement, p: Progress): number {
  if (!req) return 0;
  // a streak day is worth roughly two stars of effort
  return 'stars' in req ? req.stars - p.totalStars : (req.streak - p.bestStreak) * 2;
}

/**
 * The suit the hero actually wears: the chosen suit, recoloured, with the
 * chosen brush and add-on. Locked picks (e.g. after "delete all data") fall
 * back to the defaults.
 */
export function dressHero(hero: HeroPack, suitId: string | undefined, look: HeroLook | undefined, p: Progress): Suit {
  const base = getSuit(hero, suitId);
  const palette = { ...base.palette };
  const colors = COLORS.find((c) => c.id === look?.colors);
  if (colors && isMet(colors.req, p)) {
    palette.primary = colors.primary;
    palette.secondary = colors.secondary;
    palette.accent = colors.accent;
  }
  const brush = BRUSHES.find((b) => b.id === look?.brush);
  if (brush && brush.handle && isMet(brush.req, p)) {
    palette.brush = brush.handle;
    palette.brushStripe = brush.stripe;
    palette.bristle = brush.bristle;
    palette.brushGlow = brush.glow;
  }
  const acc = ACCESSORIES.find((a) => a.id === look?.accessory);
  const accessory = acc && acc.id !== 'none' && isMet(acc.req, p) ? acc.id : undefined;
  return { ...base, palette, accessory };
}
