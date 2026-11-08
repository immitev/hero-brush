/** Tiny typed i18n: flat message tables per language, `{name}` interpolation, one/other plurals. */
import { useMemo } from 'react';
import { useStore } from '../game/store';
import { bg } from './bg';
import { en, type MessageKey, type Messages } from './en';
import type { Lang } from './lang';

export type { MessageKey, Messages };
export type Params = Record<string, string | number>;
export * from './lang';

export const MESSAGES: Record<Lang, Messages> = { en, bg };

function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export function translate(lang: Lang, key: MessageKey, params?: Params): string {
  return interpolate(MESSAGES[lang][key] ?? en[key] ?? key, params);
}

type PluralBase = MessageKey extends infer K ? (K extends `${infer B}_one` ? B : never) : never;

/** Plural lookup: `<base>_one` for 1, `<base>_other` otherwise (true for both en and bg). */
export function translatePlural(lang: Lang, base: PluralBase, count: number, params?: Params): string {
  const key = `${base}_${count === 1 ? 'one' : 'other'}` as MessageKey;
  return translate(lang, key, { count, ...params });
}

export interface Translator {
  lang: Lang;
  t: (key: MessageKey, params?: Params) => string;
  tn: (base: PluralBase, count: number, params?: Params) => string;
  heroName: (heroId: string) => string;
  suitName: (heroId: string, suitId: string) => string;
  itemName: (category: string, id: string) => string;
}

export function makeTranslator(lang: Lang): Translator {
  const t = (key: MessageKey, params?: Params) => translate(lang, key, params);
  const lookup = (key: string, fallback: string) => (key in en ? t(key as MessageKey) : fallback);
  return {
    lang,
    t,
    tn: (base, count, params) => translatePlural(lang, base, count, params),
    heroName: (heroId) => lookup(`hero.${heroId}.name`, heroId),
    suitName: (heroId, suitId) => lookup(`suit.${heroId}.${suitId}`, suitId),
    itemName: (category, id) => lookup(`item.${category}.${id}`, id),
  };
}

export function useT(): Translator {
  const lang = useStore((s) => s.settings.lang);
  return useMemo(() => makeTranslator(lang), [lang]);
}
