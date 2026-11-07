/** Procedural sound effects. Each call builds a tiny oscillator graph and lets it die. */
import { getContext, getNoiseBuffer, getSfxBus, mtof } from './engine';

function graph(): { ctx: AudioContext; out: GainNode; t: number } | null {
  const ctx = getContext();
  const out = getSfxBus();
  if (!ctx || !out || ctx.state !== 'running') return null;
  return { ctx, out, t: ctx.currentTime };
}

function tone(
  ctx: AudioContext,
  out: AudioNode,
  t: number,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  curve: 'exp' | 'lin' = 'exp',
): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  else o.frequency.linearRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(ctx: AudioContext, out: AudioNode, t: number, filter: BiquadFilterType, f0: number, f1: number, dur: number, vol: number, q = 1): void {
  const buf = getNoiseBuffer();
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const bq = ctx.createBiquadFilter();
  bq.type = filter;
  bq.Q.value = q;
  bq.frequency.setValueAtTime(f0, t);
  bq.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bq).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.05);
}

let lastScrubAt = 0;

export const sfx = {
  /** One brushing stroke: a short "shh" of filtered noise (rate-limited). */
  scrub(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    if (t - lastScrubAt < 0.09) return;
    lastScrubAt = t;
    noise(ctx, out, t, 'bandpass', 2600, 1400, 0.11, 0.14, 0.8);
    noise(ctx, out, t + 0.005, 'highpass', 5000, 3500, 0.08, 0.05);
  },

  /** Squeaky-clean: a glide up with vibrato when a monster is fully foamed. */
  squeak(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1400, t);
    o.frequency.exponentialRampToValueAtTime(2600, t + 0.14);
    o.frequency.exponentialRampToValueAtTime(2100, t + 0.22);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 28;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(o.frequency);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(gn).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 0.28);
    lfo.stop(t + 0.28);
  },

  pop(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'sine', 300, 900, 0.12, 0.25);
    noise(ctx, out, t, 'bandpass', 1200, 400, 0.12, 0.15, 1);
  },

  bossHit(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'square', 180, 60, 0.25, 0.25);
    noise(ctx, out, t, 'lowpass', 2500, 200, 0.25, 0.3);
  },

  bossRoar(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.6);
    o.frequency.exponentialRampToValueAtTime(50, t + 1.4);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 18;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 25;
    lfo.connect(lfoG).connect(o.frequency);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.6);
    lp.frequency.exponentialRampToValueAtTime(200, t + 1.4);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.linearRampToValueAtTime(0.4, t + 0.15);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    o.connect(lp).connect(gn).connect(out);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.6);
    lfo.stop(t + 1.6);
  },

  bossDefeated(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    noise(ctx, out, t, 'lowpass', 4000, 100, 1.2, 0.4);
    tone(ctx, out, t, 'sawtooth', 200, 30, 1.0, 0.3);
    for (let i = 0; i < 6; i++) tone(ctx, out, t + 0.1 + i * 0.06, 'sine', 800 + i * 200, 2000 + i * 300, 0.25, 0.12);
  },

  zoneChime(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'sine', mtof(79), mtof(79), 0.25, 0.2);
    tone(ctx, out, t + 0.14, 'sine', mtof(84), mtof(84), 0.4, 0.2);
    tone(ctx, out, t + 0.14, 'triangle', mtof(96), mtof(96), 0.3, 0.06);
  },

  sparkle(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    for (let i = 0; i < 4; i++) tone(ctx, out, t + i * 0.05, 'sine', mtof(88 + i * 4), mtof(88 + i * 4), 0.2, 0.07);
  },

  countdown(final = false): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'square', final ? 880 : 440, final ? 880 : 440, final ? 0.5 : 0.12, 0.12);
  },

  victory(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    const notes = [72, 76, 79, 84, 79, 84, 88];
    notes.forEach((n, i) => {
      const at = t + i * 0.13;
      tone(ctx, out, at, 'square', mtof(n), mtof(n), 0.3, 0.12);
      tone(ctx, out, at, 'triangle', mtof(n - 12), mtof(n - 12), 0.35, 0.1);
    });
    for (let i = 0; i < 3; i++) tone(ctx, out, t + 1 + i * 0.02, 'sawtooth', mtof(84 - i), mtof(84 - i), 1.2, 0.06);
  },

  tap(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'sine', 600, 900, 0.09, 0.12);
  },

  go(): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    [64, 68, 71, 76].forEach((n, i) => tone(ctx, out, t + i * 0.07, 'square', mtof(n), mtof(n), 0.25, 0.1));
  },

  star(i: number): void {
    const g = graph();
    if (!g) return;
    const { ctx, out, t } = g;
    tone(ctx, out, t, 'sine', mtof(84 + i * 4), mtof(84 + i * 4), 0.4, 0.18);
    tone(ctx, out, t, 'triangle', mtof(96 + i * 4), mtof(96 + i * 4), 0.3, 0.06);
  },
};
