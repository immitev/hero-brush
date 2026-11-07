import type { HeroPack } from '../types';

export const spiderman: HeroPack = {
  id: 'spiderman',
  name: 'Spider-Man',
  tagline: 'Web shots wrap up every gunkoid.',
  attack: 'web',
  movement: 'swing',
  attackEveryBeats: 1,
  suits: [
    {
      id: 'classic',
      name: 'Classic',
      palette: {
        primary: '#d7263d',
        secondary: '#1d4ed8',
        accent: '#5a0b17',
        glow: '#ffffff',
        attack: '#f4f4f4',
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
        attack: '#e6fffa',
      },
    },
  ],
  voice: {
    select: 'Your friendly neighbourhood tooth brusher!',
    start: 'Thwip! Let us get brushing!',
    midway: 'Nice brushing! Halfway done!',
    boss: 'Whoa, the Cavity King! Web him up!',
    victory: 'All wrapped up. Great job!',
  },
  ui: { bg: '#1e3a8a', fg: '#ff6b6b' },
};
