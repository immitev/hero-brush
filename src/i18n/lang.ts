/** Language codes and detection (no React / store imports, safe to use from storage). */
export type Lang = 'en' | 'bg';
export const LANGS: readonly Lang[] = ['en', 'bg'];
/** Short label for language toggles. */
export const LANG_LABEL: Record<Lang, string> = { en: 'EN', bg: 'БГ' };
export const LANG_NAME: Record<Lang, string> = { en: 'English', bg: 'Български' };
/** BCP 47 tags for <html lang> and speech synthesis. */
export const LANG_TAG: Record<Lang, string> = { en: 'en-US', bg: 'bg-BG' };

/** Language from a list of BCP 47 tags (navigator.languages / navigator.language): bg* is Bulgarian, anything else English. */
export function detectLang(tags: readonly (string | undefined)[] | undefined): Lang {
  const first = tags?.find((t) => !!t);
  return first && first.toLowerCase().startsWith('bg') ? 'bg' : 'en';
}

export function browserLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  return detectLang([navigator.languages?.[0], navigator.language]);
}

export function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'bg';
}
