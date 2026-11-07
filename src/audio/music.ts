/**
 * Procedural 2-minute "Hero Brush" theme. 120 bpm, 4/4, 60 bars, loops.
 * Sections: A (0-15) B (16-31) A' (32-47) build (48-49) BOSS (50-59).
 * Everything is synthesised on the fly with oscillators + filtered noise.
 */
import { getContext, getMusicBus, getNoiseBuffer, mtof } from './engine';

export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const STEP = BEAT / 4; // 16th note
export const BARS = 60;
export const STEPS_PER_BAR = 16;
export const TOTAL_STEPS = BARS * STEPS_PER_BAR;

type Chord = { root: number; minor: boolean };
const C = 60;
const chord = (semi: number, minor = false): Chord => ({ root: C + semi, minor });

// progressions per 4-bar block (one chord per bar)
const PROG_A: Chord[] = [chord(0), chord(7, false), chord(9, true), chord(5)]; // C G Am F
const PROG_B: Chord[] = [chord(5), chord(0), chord(7), chord(7)]; // F C G G
const PROG_BOSS: Chord[] = [chord(9, true), chord(9, true), chord(5), chord(7)]; // Am Am F G
const PROG_BUILD: Chord[] = [chord(7), chord(7), chord(7), chord(7)];

function chordTones(c: Chord): number[] {
  const third = c.minor ? 3 : 4;
  return [0, third, 7, 12, third + 12, 14, 19].map((i) => c.root + i);
}

// melody motifs: [step, toneIndex, lengthInSteps] over a 16-step bar (-1 tone = rest)
const MOTIF_A: [number, number, number][] = [
  [0, 0, 2], [2, 1, 2], [4, 2, 4], [8, 3, 2], [10, 2, 2], [12, 1, 4],
];
const MOTIF_A2: [number, number, number][] = [
  [0, 2, 2], [2, 3, 2], [4, 4, 3], [7, 3, 1], [8, 2, 2], [10, 1, 2], [12, 0, 4],
];
const MOTIF_B: [number, number, number][] = [
  [0, 3, 1], [1, 3, 1], [2, 4, 2], [4, 3, 2], [6, 2, 2], [8, 1, 2], [10, 2, 2], [12, 3, 4],
];
const MOTIF_BOSS: [number, number, number][] = [
  [0, 0, 1], [1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 2], [6, 1, 1], [7, 0, 1], [8, 0, 1], [9, 0, 1], [10, 4, 1], [11, 3, 1], [12, 2, 1], [13, 1, 1], [14, 0, 2],
];

interface Section {
  prog: Chord[];
  motif: [number, number, number][];
  lead: OscillatorType;
  hats16: boolean;
  intensity: number; // 0..1
  pad: boolean;
}

function sectionForBar(bar: number): Section {
  const b = ((bar % BARS) + BARS) % BARS;
  if (b >= 50) return { prog: PROG_BOSS, motif: MOTIF_BOSS, lead: 'sawtooth', hats16: true, intensity: 1, pad: true };
  if (b >= 48) return { prog: PROG_BUILD, motif: [], lead: 'square', hats16: true, intensity: 0.8, pad: false };
  if (b >= 32) return { prog: PROG_A, motif: b % 8 < 4 ? MOTIF_A : MOTIF_A2, lead: 'square', hats16: false, intensity: 0.8, pad: true };
  if (b >= 16) return { prog: PROG_B, motif: MOTIF_B, lead: 'square', hats16: false, intensity: 0.7, pad: true };
  return { prog: PROG_A, motif: b % 8 < 4 ? MOTIF_A : MOTIF_A2, lead: 'triangle', hats16: false, intensity: b < 4 ? 0.45 : 0.6, pad: b >= 4 };
}

class Music {
  private timer: number | null = null;
  private startTime = 0;
  private nextStep = 0;
  private running = false;
  private out: GainNode | null = null;

  get isPlaying(): boolean {
    return this.running;
  }

  start(): void {
    const ctx = getContext();
    const bus = getMusicBus();
    if (!ctx || !bus) return;
    this.stop();
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    this.out.connect(bus);
    this.startTime = ctx.currentTime + 0.08;
    this.nextStep = 0;
    this.running = true;
    this.timer = window.setInterval(() => this.schedule(), 30);
    this.schedule();
  }

  stop(fade = 0.3): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    const ctx = getContext();
    const out = this.out;
    if (ctx && out) {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + fade);
      window.setTimeout(() => out.disconnect(), fade * 1000 + 50);
    }
    this.out = null;
  }

  /**
   * Re-aligns the sequencer so that musical time equals `seconds` from now on
   * (used at segment transitions so the music's final build-up lands on the last segments).
   * Small drift is ignored; larger drift skips/rewinds steps.
   */
  syncTo(seconds: number, tolerance = 0.12): void {
    const ctx = getContext();
    if (!ctx || !this.running) return;
    const musicalNow = ctx.currentTime - this.startTime;
    const drift = musicalNow - seconds;
    if (Math.abs(drift) < tolerance) return;
    this.startTime = ctx.currentTime - seconds;
    // continue scheduling from the next step that has not sounded yet
    this.nextStep = Math.max(0, Math.ceil(seconds / STEP));
  }

  private schedule(): void {
    const ctx = getContext();
    if (!ctx || !this.running || !this.out) return;
    const lookahead = 0.15;
    while (this.startTime + this.nextStep * STEP < ctx.currentTime + lookahead) {
      const when = this.startTime + this.nextStep * STEP;
      if (when >= ctx.currentTime - 0.05) this.playStep(ctx, this.out, this.nextStep, when);
      this.nextStep++;
    }
  }

  private playStep(ctx: AudioContext, out: GainNode, stepIndex: number, when: number): void {
    const loopStep = stepIndex % TOTAL_STEPS;
    const bar = Math.floor(loopStep / STEPS_PER_BAR);
    const step = loopStep % STEPS_PER_BAR;
    const sec = sectionForBar(bar);
    const ch = sec.prog[bar % 4];
    const tones = chordTones(ch);
    const vol = sec.intensity;

    // --- drums ---
    const isBuild = bar >= 48 && bar < 50;
    if (isBuild) {
      // snare roll that accelerates + riser
      const buildPos = (bar - 48) * STEPS_PER_BAR + step; // 0..31
      const every = buildPos < 16 ? 2 : 1;
      if (buildPos % every === 0) this.snare(ctx, out, when, 0.3 + buildPos / 60);
      if (step % 4 === 0) this.kick(ctx, out, when, 0.9);
      if (buildPos === 0) this.riser(ctx, out, when, 32 * STEP);
    } else {
      const kickSteps = sec.intensity >= 1 ? [0, 4, 8, 12] : [0, 8, 10];
      if (kickSteps.includes(step)) this.kick(ctx, out, when, 0.8 + 0.2 * vol);
      if (step === 4 || step === 12) this.snare(ctx, out, when, 0.5 * vol + 0.2);
      if (bar >= 4) {
        const hatEvery = sec.hats16 ? 1 : 2;
        if (step % hatEvery === 0) this.hat(ctx, out, when, step % 4 === 2 ? 0.25 : 0.14, step % 4 === 0 ? 0.03 : 0.02);
      }
      if (bar >= 50 && step === 14) this.snare(ctx, out, when, 0.35);
    }

    // --- bass (8ths) ---
    if (step % 2 === 0) {
      const pattern = [0, 0, 7, 0, 0, 12, 7, 5];
      const semi = sec.intensity >= 1 ? [0, 0, 0, 7, 0, 0, 12, 10][step / 2] : pattern[step / 2];
      const note = ch.root - 24 + semi;
      this.bass(ctx, out, when, mtof(note), STEP * 1.8, 0.35 * (0.6 + 0.4 * vol));
    }

    // --- pad (chord on the downbeat) ---
    if (sec.pad && step === 0) {
      for (const n of [tones[0], tones[1], tones[2]]) this.pad(ctx, out, when, mtof(n), BEAT * 4, 0.05 * (0.5 + vol * 0.5));
    }

    // --- lead melody ---
    for (const [s, toneIdx, len] of sec.motif) {
      if (s !== step) continue;
      const octave = sec.intensity >= 1 ? 12 : 0;
      const note = tones[Math.min(toneIdx, tones.length - 1)] + octave;
      this.lead(ctx, out, when, mtof(note), len * STEP * 0.9, 0.16 * (0.7 + 0.3 * vol), sec.lead);
    }

    // sparkle arpeggio in B sections
    if (bar >= 16 && bar < 32 && step % 4 === 2) {
      const n = tones[(Math.floor(step / 4) + bar) % 4] + 24;
      this.pluck(ctx, out, when, mtof(n), 0.05);
    }
  }

  // ---------------- instruments ----------------
  private env(ctx: AudioContext, when: number, a: number, d: number, s: number, r: number, dur: number, peak: number): GainNode {
    const g = ctx.createGain();
    const t0 = when;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t0 + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * s), t0 + Math.max(a + d, dur));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(a + d, dur) + r);
    return g;
  }

  private lead(ctx: AudioContext, out: GainNode, when: number, freq: number, dur: number, vol: number, type: OscillatorType): void {
    const g = this.env(ctx, when, 0.01, 0.08, 0.6, 0.08, dur, vol);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(type === 'sawtooth' ? 3500 : 2600, when);
    lp.frequency.exponentialRampToValueAtTime(1200, when + dur + 0.1);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.2);
    }
    lp.connect(g).connect(out);
  }

  private pluck(ctx: AudioContext, out: GainNode, when: number, freq: number, vol: number): void {
    const g = this.env(ctx, when, 0.003, 0.12, 0.0, 0.05, 0.12, vol);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + 0.3);
  }

  private bass(ctx: AudioContext, out: GainNode, when: number, freq: number, dur: number, vol: number): void {
    const g = this.env(ctx, when, 0.005, 0.1, 0.5, 0.05, dur, vol);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, when);
    lp.frequency.exponentialRampToValueAtTime(250, when + dur);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = freq;
    o.connect(lp);
    sub.connect(lp);
    lp.connect(g).connect(out);
    o.start(when);
    sub.start(when);
    o.stop(when + dur + 0.1);
    sub.stop(when + dur + 0.1);
  }

  private pad(ctx: AudioContext, out: GainNode, when: number, freq: number, dur: number, vol: number): void {
    const g = this.env(ctx, when, 0.3, 0.5, 0.8, 0.4, dur, vol);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    for (const det of [-8, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(when);
      o.stop(when + dur + 0.5);
    }
    lp.connect(g).connect(out);
  }

  private kick(ctx: AudioContext, out: GainNode, when: number, vol: number): void {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + 0.32);
  }

  private snare(ctx: AudioContext, out: GainNode, when: number, vol: number): void {
    const buf = getNoiseBuffer();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
    src.connect(bp).connect(g).connect(out);
    src.start(when);
    src.stop(when + 0.2);
    // body
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, when);
    o.frequency.exponentialRampToValueAtTime(120, when + 0.08);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(vol * 0.5, when);
    g2.gain.exponentialRampToValueAtTime(0.001, when + 0.1);
    o.connect(g2).connect(out);
    o.start(when);
    o.stop(when + 0.12);
  }

  private hat(ctx: AudioContext, out: GainNode, when: number, vol: number, dur: number): void {
    const buf = getNoiseBuffer();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur + 0.02);
    src.connect(hp).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }

  private riser(ctx: AudioContext, out: GainNode, when: number, dur: number): void {
    const buf = getNoiseBuffer();
    if (!buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.5;
    bp.frequency.setValueAtTime(300, when);
    bp.frequency.exponentialRampToValueAtTime(6000, when + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02, when);
    g.gain.linearRampToValueAtTime(0.28, when + dur);
    g.gain.setValueAtTime(0.0001, when + dur + 0.02);
    src.connect(bp).connect(g).connect(out);
    src.start(when);
    src.stop(when + dur + 0.05);
  }
}

export const music = new Music();
