import type { HeroPack } from '../types';

export const batman: HeroPack = {
  id: 'batman',
  name: 'Batman',
  movement: 'glide',
  travelSpeed: 6.5,
  suits: [
    {
      id: 'classic',
      name: 'Dark Knight',
      palette: {
        primary: '#6a4c9c',
        secondary: '#2d2150',
        accent: '#5ee6d0',
        glow: '#ffffff',
        brush: '#5ee6d0',
        skin: '#f1c9a5',
      },
    },
    {
      id: 'blue',
      name: 'Blue Knight',
      palette: {
        primary: '#8f9bb3',
        secondary: '#1f3a93',
        accent: '#f2c14e',
        glow: '#ffffff',
        brush: '#1f3a93',
        skin: '#f1c9a5',
      },
    },
  ],
  ui: { bg: '#241a3d', fg: '#7ef0dc' },
};
