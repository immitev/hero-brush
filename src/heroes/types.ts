import type { HeroSpeaker } from '../voice/lines';

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
  /** Second handle colour (stripes), set by a wardrobe brush. */
  brushStripe?: string;
  /** Bristle colour, set by a wardrobe brush (default white). */
  bristle?: string;
  /** Glowing handle, set by a wardrobe brush. */
  brushGlow?: boolean;
  /** Exposed skin (Batman's chin). */
  skin?: string;
}

export type AccessoryId = 'crown' | 'cap' | 'shades' | 'headphones' | 'bow';

export interface Suit {
  id: string;
  name: string;
  palette: HeroPalette;
  /** Wearable add-on chosen in the wardrobe. */
  accessory?: AccessoryId;
}

export interface HeroPack {
  /** Also the voice speaker id (src/voice/lines.json). */
  id: HeroSpeaker;
  /** English name; the UI uses the translated `hero.<id>.name` (src/i18n). */
  name: string;
  movement: MovementKind;
  /** World units per second when travelling between teeth. */
  travelSpeed: number;
  suits: Suit[];
  /** UI colours. */
  ui: { bg: string; fg: string };
}
