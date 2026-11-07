export type AttackKind = 'beam' | 'web' | 'batarang';
export type MovementKind = 'hover' | 'swing' | 'glide';

export interface HeroPalette {
  /** Main suit colour. */
  primary: string;
  /** Secondary suit colour (gold, blue, grey...). */
  secondary: string;
  /** Small accents (belts, details). */
  accent: string;
  /** Glowing parts: reactor, lenses, eyes. */
  glow: string;
  /** Projectile / attack colour. */
  attack: string;
  /** Exposed skin (Batman's chin). */
  skin?: string;
}

export interface Suit {
  id: string;
  name: string;
  palette: HeroPalette;
}

export interface HeroVoice {
  select: string;
  start: string;
  boss: string;
  victory: string;
  midway: string;
}

export interface HeroPack {
  id: string;
  name: string;
  tagline: string;
  attack: AttackKind;
  movement: MovementKind;
  /** Beats between attacks at 120 bpm (1 = every beat). */
  attackEveryBeats: number;
  suits: Suit[];
  voice: HeroVoice;
  /** UI colours. */
  ui: { bg: string; fg: string };
}
