import { describe, expect, it } from 'vitest';
import { bg } from './bg';
import { en } from './en';
import { detectLang, makeTranslator, translate } from './index';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('i18n tables', () => {
  const keys = Object.keys(en) as (keyof typeof en)[];

  it('bg has every en key and nothing else', () => {
    expect(Object.keys(bg).sort()).toEqual([...keys].sort());
  });

  it('has no empty strings', () => {
    for (const k of keys) {
      expect(en[k].trim(), `en ${k}`).not.toBe('');
      expect(bg[k].trim(), `bg ${k}`).not.toBe('');
    }
  });

  it('bg only uses placeholders that the en string is given', () => {
    // bg may leave one out where grammar works better without it (e.g. the hero name after "с")
    for (const k of keys) for (const p of placeholders(bg[k])) expect(placeholders(en[k]), `${k} {${p}}`).toContain(p);
  });

  it('bg strings are written in Cyrillic (no leftover English)', () => {
    for (const k of keys) {
      const letters = bg[k].replace(/\{\w+\}/g, '').replace(/[^\p{L}]/gu, '');
      if (!letters) continue;
      expect(/[Ѐ-ӿ]/.test(letters), `bg ${k}: ${bg[k]}`).toBe(true);
    }
  });

  it('defines both plural forms', () => {
    for (const k of keys) {
      if (k.endsWith('_one')) expect(keys).toContain(k.replace(/_one$/, '_other'));
      if (k.endsWith('_other')) expect(keys).toContain(k.replace(/_other$/, '_one'));
    }
  });
});

describe('translate', () => {
  it('interpolates and picks plurals', () => {
    expect(translate('en', 'select.start', { hero: 'Batman' })).toBe('Brush with Batman!');
    const bgT = makeTranslator('bg');
    expect(bgT.tn('victory.streak', 1)).toBe('1 ден поред');
    expect(bgT.tn('victory.streak', 3)).toBe('3 дни поред');
    expect(bgT.heroName('ironman')).toBe('Железарко');
    expect(bgT.suitName('batman', 'classic')).toBe('Нощен пазач');
    expect(bgT.heroName('unknown')).toBe('unknown');
  });

  it('detects the language from navigator tags', () => {
    expect(detectLang(['bg-BG'])).toBe('bg');
    expect(detectLang(['bg'])).toBe('bg');
    expect(detectLang(['BG'])).toBe('bg');
    expect(detectLang(['en-GB', 'bg'])).toBe('en');
    expect(detectLang(['de-DE'])).toBe('en');
    expect(detectLang([undefined, 'bg-BG'])).toBe('bg');
    expect(detectLang(undefined)).toBe('en');
  });
});
