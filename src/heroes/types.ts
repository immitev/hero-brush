/** How the hero travels between teeth: jets, swings on a web line, or glides with a cape. */
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
  /** Toothbrush handle colour. */
  brush: string;
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
  movement: MovementKind;
  /** World units per second when travelling between teeth. */
  travelSpeed: number;
  suits: Suit[];
  voice: HeroVoice;
  /** UI colours. */
  ui: { bg: string; fg: string };
}
