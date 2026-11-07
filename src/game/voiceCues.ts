/**
 * Scripted voice cues during a session (besides zone prompts, boss and victory lines).
 * Times are session seconds; they sit mid-zone so they do not collide with zone prompts.
 */
import type { HeroLine, NarratorLine } from '../voice/lines';

export type VoiceCue = { at: number; speaker: 'hero'; line: HeroLine } | { at: number; speaker: 'narrator'; line: NarratorLine };

export const VOICE_CUES: readonly VoiceCue[] = [
  { at: 10, speaker: 'hero', line: 'quip1' },
  { at: 30, speaker: 'narrator', line: 'praise1' },
  { at: 50, speaker: 'hero', line: 'quip2' },
  { at: 70, speaker: 'narrator', line: 'praise2' },
  { at: 90, speaker: 'hero', line: 'quip3' },
  { at: 112, speaker: 'narrator', line: 'almost' },
];

export function voiceCueAt(i: number): VoiceCue | undefined {
  return VOICE_CUES[i];
}
