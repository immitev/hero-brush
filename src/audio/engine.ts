/**
 * Shared Web Audio graph. Created lazily and resumed from a user gesture
 * (the GO button) so it works on iOS.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

// Volumes are remembered here so that values set before the context exists
// (settings loaded at startup) are applied when the buses are created.
let musicVolume = 0.7;
let sfxVolume = 0.8;

function applyVolumes(): void {
  if (musicBus) musicBus.gain.value = musicVolume * musicVolume; // perceptual-ish curve
  if (sfxBus) sfxBus.gain.value = sfxVolume * sfxVolume;
}

export function getContext(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus.connect(master);
  sfxBus.connect(master);
  applyVolumes();
  return ctx;
}

export function getMusicBus(): GainNode | null {
  getContext();
  return musicBus;
}

export function getSfxBus(): GainNode | null {
  getContext();
  return sfxBus;
}

/** True when the context can be resumed ('suspended' or iOS 'interrupted'). */
function needsResume(c: AudioContext): boolean {
  const state = c.state as string;
  return state !== 'running' && state !== 'closed';
}

/** Must be called from a user gesture (tap). */
export async function unlockAudio(): Promise<void> {
  const c = getContext();
  if (!c) return;
  if (needsResume(c)) {
    try {
      await c.resume();
    } catch {
      /* ignore */
    }
  }
  // iOS: play a silent buffer to fully unlock
  const buf = c.createBuffer(1, 1, 22050);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start(0);
}

export async function suspendAudio(): Promise<void> {
  if (ctx && ctx.state === 'running') {
    try {
      await ctx.suspend();
    } catch {
      /* ignore */
    }
  }
}

export async function resumeAudio(): Promise<void> {
  if (ctx && needsResume(ctx)) {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
}

export function setVolumes(music: number, sfx: number): void {
  musicVolume = Math.max(0, Math.min(1, music));
  sfxVolume = Math.max(0, Math.min(1, sfx));
  applyVolumes();
}

export function getNoiseBuffer(): AudioBuffer | null {
  const c = getContext();
  if (!c) return null;
  if (noiseBuffer) return noiseBuffer;
  const len = c.sampleRate * 2;
  noiseBuffer = c.createBuffer(1, len, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** MIDI note number → frequency. */
export function mtof(n: number): number {
  return 440 * Math.pow(2, (n - 69) / 12);
}
