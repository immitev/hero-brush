import type { HeroPack } from '../types';

export const ironman: HeroPack = {
  id: 'ironman',
  name: 'Iron Man',
  tagline: 'Repulsor blasts. Plaque never stood a chance.',
  attack: 'beam',
  movement: 'hover',
  attackEveryBeats: 1,
  suits: [
    {
      id: 'classic',
      name: 'Classic',
      palette: {
        primary: '#c8102e',
        secondary: '#f2b134',
        accent: '#8a0b1f',
        glow: '#8ff7ff',
        attack: '#9af5ff',
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
        attack: '#9fc4ff',
      },
    },
  ],
  voice: {
    select: 'Suit up. Let us polish those teeth.',
    start: 'Repulsors online. Brush time!',
    midway: 'Halfway there. Keep brushing!',
    boss: 'The Cavity King! Full power!',
    victory: 'Sparkling clean. Mission complete!',
  },
  ui: { bg: '#5a0f1f', fg: '#ffd166' },
};
