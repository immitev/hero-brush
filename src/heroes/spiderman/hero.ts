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
        primary: '#a463f2',
        secondary: '#ffcf3f',
        accent: '#9150e0',
        glow: '#ffffff',
        brush: '#ffcf3f',
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
  ui: { bg: '#3b2a8a', fg: '#ffd84d' },
};
