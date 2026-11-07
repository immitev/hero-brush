import type { HeroPack } from '../types';

export const ironman: HeroPack = {
  id: 'ironman',
  name: 'Iron Man',
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
  ui: { bg: '#5a0f1f', fg: '#ffd166' },
};
