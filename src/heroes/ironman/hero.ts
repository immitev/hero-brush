import type { HeroPack } from '../types';

export const ironman: HeroPack = {
  id: 'ironman',
  name: 'Iron Man',
  tagline: 'Jets from tooth to tooth and power-scrubs the gunk.',
  movement: 'hover',
  travelSpeed: 7,
  suits: [
    {
      id: 'classic',
      name: 'Classic',
      palette: {
        primary: '#c8102e',
        secondary: '#f2b134',
        accent: '#8a0b1f',
        glow: '#8ff7ff',
        brush: '#f2b134',
      },
    },
    {
      id: 'stealth',
      name: 'Stealth',
      palette: {
        primary: '#2b2f3a',
        secondary: '#6c7384',
        accent: '#15171d',
        glow: '#7fb0ff',
        brush: '#7fb0ff',
      },
    },
  ],
  voice: {
    select: 'Suit up. Let us polish those teeth.',
    start: 'Jet brush online. Brush time!',
    midway: 'Halfway there. Keep brushing!',
    boss: 'The Cavity King! Full scrub power!',
    victory: 'Sparkling clean. Mission complete!',
  },
  ui: { bg: '#5a0f1f', fg: '#ffd166' },
};
