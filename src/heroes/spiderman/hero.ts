import type { HeroPack } from '../types';

export const spiderman: HeroPack = {
  id: 'spiderman',
  name: 'Spider-Man',
  movement: 'swing',
  travelSpeed: 8,
  suits: [
    {
      id: 'classic',
      name: 'Classic',
      palette: {
        primary: '#d7263d',
        secondary: '#1d4ed8',
        accent: '#5a0b17',
        glow: '#ffffff',
        brush: '#1d4ed8',
      },
    },
    {
      id: 'mint',
      name: 'Toothpaste Mint',
      palette: {
        primary: '#39d2a4',
        secondary: '#f5f7fa',
        accent: '#117a65',
        glow: '#ffffff',
        brush: '#117a65',
      },
    },
  ],
  ui: { bg: '#1e3a8a', fg: '#ff6b6b' },
};
