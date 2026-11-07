import { batman } from './batman/hero';
import { ironman } from './ironman/hero';
import { spiderman } from './spiderman/hero';
import type { HeroPack, Suit } from './types';

export const HEROES: readonly HeroPack[] = [ironman, spiderman, batman];

export function getHero(id: string): HeroPack {
  return HEROES.find((h) => h.id === id) ?? HEROES[0];
}

export function getSuit(hero: HeroPack, suitId: string | undefined): Suit {
  return hero.suits.find((s) => s.id === suitId) ?? hero.suits[0];
}

export type { HeroPack, Suit, HeroPalette, MovementKind } from './types';
