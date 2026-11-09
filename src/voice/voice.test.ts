import { describe, expect, it } from 'vitest';
import { decide } from '../audio/voice';
import { SEGMENTS } from '../game/segments';
import { VOICE_CUES } from '../game/voiceCues';
import { HEROES } from '../heroes';
import { LANGS } from '../i18n/lang';
import { HERO_LINES, LINES, SPEAKERS, VOICES, lineText } from './lines';
import stress from './stress.json';

describe('voice lines', () => {
  it('every line has text in every language', () => {
    for (const speaker of SPEAKERS) {
      for (const [id, texts] of Object.entries(LINES[speaker])) {
        for (const lang of LANGS) expect(texts[lang]?.trim(), `${lang}/${speaker}/${id}`).toBeTruthy();
        expect(Object.keys(texts).sort(), `${speaker}/${id}`).toEqual([...LANGS].sort());
      }
    }
  });

  it('bg lines are Cyrillic', () => {
    for (const speaker of SPEAKERS)
      for (const id of Object.keys(LINES[speaker])) expect(/[Ѐ-ӿ]/.test(lineText('bg', speaker, id)), `${speaker}/${id}`).toBe(true);
  });

  it('every hero is a speaker with the same set of lines', () => {
    for (const hero of HEROES) {
      expect(SPEAKERS).toContain(hero.id);
      expect(Object.keys(LINES[hero.id]).sort()).toEqual([...HERO_LINES].sort());
    }
    expect(SPEAKERS.filter((s) => s !== 'narrator').sort()).toEqual(HEROES.map((h) => h.id).sort());
  });

  it('segment prompts and scripted cues refer to existing lines', () => {
    for (const s of SEGMENTS) expect(LINES.narrator[s.voice], s.voice).toBeTruthy();
    expect(new Set(SEGMENTS.map((s) => s.voice)).size).toBe(SEGMENTS.length);
    for (const c of VOICE_CUES) {
      const speaker = c.speaker === 'hero' ? 'ironman' : 'narrator';
      expect(LINES[speaker][c.line], c.line).toBeTruthy();
      // cues never land on a segment boundary (where the prompt plays)
      expect(SEGMENTS.some((s) => Math.abs(s.start - c.at) < 3), `cue at ${c.at}`).toBe(false);
    }
    for (const n of [1, 2, 3]) expect(LINES.narrator[`count${n}`]).toBeTruthy();
    for (const id of ['go', 'goodTry', 'spit']) expect(LINES.narrator[id]).toBeTruthy();
    for (const id of ['select', 'victory']) expect(HERO_LINES).toContain(id);
    expect(HERO_LINES).not.toContain('boss');
  });

  it('coaching lines teach the technique and never say "rinse" after brushing', () => {
    const en = Object.values(LINES.narrator).map((l) => l.en ?? '').join(' ').toLowerCase();
    for (const word of ['45', 'forty-five', 'circles']) void word;
    expect(en).toMatch(/small.*circles/);
    expect(en).toMatch(/gum/);
    expect(en).toMatch(/flat/);
    expect(en).toMatch(/tongue/);
    expect(lineText('en', 'narrator', 'spit').toLowerCase()).toMatch(/don't rinse|do not rinse/);
    expect(lineText('bg', 'narrator', 'spit')).toMatch(/не изплаквай/);
    expect(en).not.toMatch(/cavity king|monster|gunk/);
  });

  it('every speaker has a voice in every language', () => {
    for (const lang of LANGS) for (const s of SPEAKERS) expect(VOICES.languages[lang].speakers[s]?.voice, `${lang}/${s}`).toBeTruthy();
  });

  it('heroes sound different from each other within a language', () => {
    for (const lang of LANGS) {
      const sigs = HEROES.map((h) => JSON.stringify({ ...VOICES.languages[lang].speakers[h.id], fallback: undefined }));
      expect(new Set(sigs).size, lang).toBe(HEROES.length);
    }
  });
});

describe('voice queue policy', () => {
  it('high interrupts, low only plays when idle, normal waits or replaces low', () => {
    expect(decide('high', 'normal', 2)).toBe('interrupt');
    expect(decide('low', null, 0)).toBe('play');
    expect(decide('low', 'low', 0)).toBe('drop');
    expect(decide('low', null, 1)).toBe('drop');
    expect(decide('normal', null, 0)).toBe('play');
    expect(decide('normal', 'low', 0)).toBe('replace');
    expect(decide('normal', 'normal', 0)).toBe('enqueue');
    expect(decide('normal', 'high', 0)).toBe('enqueue');
  });
  it('every Bulgarian word of 2+ syllables has a stress entry', () => {
    const dict: Record<string, string> = stress.bg;
    const missing = new Set<string>();
    for (const speaker of SPEAKERS)
      for (const id of Object.keys(LINES[speaker]))
        for (const [w] of lineText('bg', speaker, id).toLowerCase().matchAll(/[а-яѝ]+/g))
          if ((w.match(/[аеиоуъюя]/g) ?? []).length > 1 && !dict[w]) missing.add(w);
    expect([...missing]).toEqual([]);
  });

  it('stress entries mark exactly one vowel of the same word', () => {
    for (const [word, marked] of Object.entries(stress.bg as Record<string, string>)) {
      expect(marked.toLowerCase(), word).toBe(word);
      expect(marked.match(/[АЕИОУЪЮЯ]/g)?.length, word).toBe(1);
      expect(marked.replace(/[АЕИОУЪЮЯ]/, '').match(/[А-Я]/), word).toBeNull();
    }
  });
});
