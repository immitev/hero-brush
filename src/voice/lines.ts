/**
 * Typed access to the voice data shared with scripts/gen-voices.mjs:
 * lines.json (texts per speaker / line / language) and voices.json (Azure voice + prosody, plus
 * pitch/rate hints for the speech-synthesis fallback).
 */
import type { Lang } from '../i18n/lang';
import lines from './lines.json';
import voices from './voices.json';

export type Speaker = keyof typeof lines;
export type HeroSpeaker = Exclude<Speaker, 'narrator'>;
export type NarratorLine = keyof (typeof lines)['narrator'];
/** Every hero has the same set of line ids (checked by voice.test.ts). */
export type HeroLine = keyof (typeof lines)['ironman'];
export type LineId = NarratorLine | HeroLine;

export const SPEAKERS = Object.keys(lines) as Speaker[];
export const HERO_LINES = Object.keys(lines.ironman) as HeroLine[];
export const HERO_QUIPS: readonly HeroLine[] = ['quip1', 'quip2', 'quip3'];

type LineTable = Record<string, Record<string, Partial<Record<Lang, string>>>>;
type VoiceTable = {
  languages: Record<string, { xmlLang: string; speakers: Record<string, { voice: string; fallback?: { pitch?: number; rate?: number } }> }>;
};

export const LINES = lines as LineTable;
export const VOICES = voices as VoiceTable;

export function isSpeaker(id: string): id is Speaker {
  return id in lines;
}

export function lineIds(speaker: Speaker): string[] {
  return Object.keys(LINES[speaker] ?? {});
}

/** Text of a line in a language ('' if it does not exist). */
export function lineText(lang: Lang, speaker: Speaker, id: string): string {
  return LINES[speaker]?.[id]?.[lang] ?? '';
}

/** Pitch / rate for the browser speech-synthesis fallback, so speakers still sound different. */
export function fallbackProsody(lang: Lang, speaker: Speaker): { pitch: number; rate: number } {
  const f = VOICES.languages[lang]?.speakers[speaker]?.fallback;
  return { pitch: f?.pitch ?? 1.1, rate: f?.rate ?? 1 };
}
