/**
 * Scripted voice cues during a session (besides the segment prompts and the
 * victory lines). Times are session seconds, placed a few seconds into a
 * segment so they do not collide with the segment prompt.
 */
import type { HeroLine, NarratorLine } from '../voice/lines';

export type VoiceCue = { at: number; speaker: 'hero'; line: HeroLine } | { at: number; speaker: 'narrator'; line: NarratorLine };

export const VOICE_CUES: readonly VoiceCue[] = [
  { at: 8, speaker: 'hero', line: 'quip1' },
  { at: 23, speaker: 'narrator', line: 'praise1' },
  { at: 38, speaker: 'hero', line: 'quip2' },
  { at: 53, speaker: 'narrator', line: 'praise2' },
  { at: 83, speaker: 'hero', line: 'quip3' },
  { at: 115, speaker: 'narrator', line: 'almost' },
];

export function voiceCueAt(i: number): VoiceCue | undefined {
  return VOICE_CUES[i];
}
