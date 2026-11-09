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
        primary: '#5f7fa8',
        secondary: '#ff9f43',
        accent: '#2c3e57',
        glow: '#8ff7d4',
        brush: '#ff9f43',
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
  ui: { bg: '#1f3350', fg: '#ffb46b' },
};
