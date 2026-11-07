import type { HeroPack } from '../types';

export const batman: HeroPack = {
  id: 'batman',
  name: 'Batman',
  tagline: 'Glides in from the shadows of the molars to scrub.',
  movement: 'glide',
  travelSpeed: 6.5,
  suits: [
    {
      id: 'classic',
      name: 'Dark Knight',
      palette: {
        primary: '#4a4f5c',
        secondary: '#15171c',
        accent: '#f2c14e',
        glow: '#ffffff',
        brush: '#f2c14e',
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
  voice: {
    select: 'I am the night. And it is brush time.',
    start: 'Plaque beware. Begin brushing.',
    midway: 'Halfway. Do not stop now.',
    boss: 'The Cavity King. This ends now.',
    victory: 'Justice served. Teeth clean.',
  },
  ui: { bg: '#1a1d26', fg: '#f2c14e' },
};
