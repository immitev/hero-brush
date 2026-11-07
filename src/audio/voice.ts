/**
 * Voice lines. Each (language, speaker, line) has a neural-TTS MP3 generated at build time
 * (scripts/gen-voices.mjs → public/voice/). They are decoded once into AudioBuffers and played
 * through the voice bus of the shared Web Audio graph. If a file is missing (or Web Audio is
 * unavailable) the line is spoken with the browser's speech synthesis in the right language.
 *
 * Only one line plays at a time:
 *  - 'high'   interrupts everything and clears the queue (countdown, hero select, early quit)
 *  - 'normal' waits for the current line (zone prompts, boss, victory); interrupts a 'low' one
 *  - 'low'    is dropped unless nothing is playing or queued (quips, praise)
 * Queued lines that waited too long are dropped so prompts never lag behind the game.
 */
import { LANG_TAG, type Lang } from '../i18n/lang';
import { type LineId, type Speaker, fallbackProsody, lineIds, lineText } from '../voice/lines';
import { getContext, getVoiceBus, getVoiceLevel, setVoiceVolume } from './engine';

export type Priority = 'low' | 'normal' | 'high';
const RANK: Record<Priority, number> = { low: 0, normal: 1, high: 2 };
/** Queued lines older than this (real time) are dropped (long enough for the boss line to wait out the last zone prompt). */
export const MAX_QUEUE_WAIT_MS = 8000;

interface Item {
  lang: Lang;
  speaker: Speaker;
  id: string;
  priority: Priority;
  queuedAt: number;
}

interface Playing {
  item: Item;
  token: number;
  source?: AudioBufferSourceNode;
  timer?: number;
}

type ManifestEntry = { file: string; hash: string };
type Manifest = Partial<Record<string, Record<string, Record<string, ManifestEntry>>>>;

let lang: Lang = 'en';
let muted = false;
let volume = 0.9;
let current: Playing | null = null;
let queue: Item[] = [];
let tokenSeq = 0;
let manifestPromise: Promise<Manifest> | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

const hasSpeech = () => typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const base = () => (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

// ---------------------------------------------------------------- settings

export function setVoiceLang(l: Lang): void {
  if (l === lang) return;
  lang = l;
  stopVoice();
}

export function getVoiceLang(): Lang {
  return lang;
}

export function setVoiceMuted(v: boolean): void {
  muted = v;
  setVoiceVolume(volume, muted);
  if (v) stopVoice();
}

export function setVoiceLevel(v: number): void {
  volume = v;
  setVoiceVolume(volume, muted);
}

// ---------------------------------------------------------------- loading

function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) {
    manifestPromise =
      typeof fetch === 'undefined'
        ? Promise.resolve({})
        : fetch(`${base()}voice/manifest.json`)
            .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : {}))
            .catch(() => {
              manifestPromise = null; // try again next time (e.g. came back online)
              return {};
            });
  }
  return manifestPromise;
}

function bufferKey(l: Lang, speaker: Speaker, id: string): string {
  return `${l}/${speaker}/${id}`;
}

async function fetchBuffer(l: Lang, speaker: Speaker, id: string): Promise<AudioBuffer | null> {
  const ctx = getContext();
  if (!ctx) return null;
  const entry = (await loadManifest())[l]?.[speaker]?.[id];
  if (!entry) return null;
  const res = await fetch(`${base()}voice/${entry.file}`);
  if (!res.ok) throw new Error(`voice ${entry.file}: HTTP ${res.status}`);
  const data = await res.arrayBuffer();
  return await ctx.decodeAudioData(data);
}

/** Decoded buffer for a line, or null when there is no generated file (cached). */
function loadBuffer(l: Lang, speaker: Speaker, id: string): Promise<AudioBuffer | null> {
  const key = bufferKey(l, speaker, id);
  let p = buffers.get(key);
  if (!p) {
    p = fetchBuffer(l, speaker, id).catch((err) => {
      console.warn('voice line unavailable, using speech synthesis', key, err);
      buffers.delete(key); // allow a later retry
      return null;
    });
    buffers.set(key, p);
  }
  return p;
}

/** Fetches and decodes every line of the given speakers (current language) in the background. */
export function preloadVoices(speakers: readonly Speaker[], only?: readonly string[]): Promise<void> {
  const l = lang;
  const jobs: Promise<unknown>[] = [];
  for (const s of speakers) for (const id of only ?? lineIds(s)) jobs.push(loadBuffer(l, s, id));
  return Promise.all(jobs).then(() => undefined);
}

// ---------------------------------------------------------------- speech fallback

let fallbackVoices: Partial<Record<Lang, SpeechSynthesisVoice | null>> = {};

function pickSpeechVoice(l: Lang): SpeechSynthesisVoice | null {
  if (!hasSpeech()) return null;
  if (fallbackVoices[l] !== undefined) return fallbackVoices[l] ?? null;
  const all = speechSynthesis.getVoices();
  if (!all.length) return null;
  const prefix = l === 'bg' ? 'bg' : 'en';
  const matching = all.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  const score = (v: SpeechSynthesisVoice) =>
    (v.localService ? 2 : 0) + (/natural|neural|google|samantha|zira|aria|jenny|kalina|ivan/i.test(v.name) ? 1 : 0) + (v.default ? 0.5 : 0);
  const best = matching.sort((a, b) => score(b) - score(a))[0] ?? null;
  fallbackVoices[l] = best;
  return best;
}

if (hasSpeech()) {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    fallbackVoices = {};
  });
}

/**
 * iOS only allows speech that was started synchronously inside a user gesture.
 * Call this from the tap handler (before any `await`) to unlock the speech fallback.
 */
export function primeSpeech(): void {
  if (!hasSpeech()) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    speechSynthesis.speak(u);
    pickSpeechVoice(lang);
  } catch {
    /* ignore */
  }
}

/** Speaks with speech synthesis; calls `done` when finished (or after a safety timeout). */
function speakFallback(p: Playing, done: () => void): void {
  const { item } = p;
  const text = lineText(item.lang, item.speaker, item.id);
  const level = getVoiceLevel();
  if (!text || !hasSpeech() || level <= 0) {
    done();
    return;
  }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickSpeechVoice(item.lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? LANG_TAG[item.lang];
    const { pitch, rate } = fallbackProsody(item.lang, item.speaker);
    u.pitch = pitch;
    u.rate = rate;
    u.volume = level;
    u.onend = done;
    u.onerror = done;
    // some engines never fire onend; never let the queue get stuck
    p.timer = window.setTimeout(done, 1500 + text.length * 110);
    speechSynthesis.speak(u);
  } catch {
    done();
  }
}

// ---------------------------------------------------------------- playback

function stopCurrent(): void {
  const p = current;
  current = null;
  if (!p) return;
  if (p.timer) clearTimeout(p.timer);
  if (p.source) {
    p.source.onended = null;
    try {
      p.source.stop();
    } catch {
      /* already stopped */
    }
  }
  if (hasSpeech()) speechSynthesis.cancel();
}

function finish(token: number): void {
  if (!current || current.token !== token) return;
  if (current.timer) clearTimeout(current.timer);
  current = null;
  playNext();
}

function playNext(): void {
  const t = now();
  while (queue.length) {
    const item = queue.shift()!;
    if (item.lang !== lang || t - item.queuedAt > MAX_QUEUE_WAIT_MS) continue;
    start(item);
    return;
  }
}

function start(item: Item): void {
  const token = ++tokenSeq;
  const p: Playing = { item, token };
  current = p;
  void loadBuffer(item.lang, item.speaker, item.id).then((buffer) => {
    if (current !== p) return; // stopped or replaced while loading
    const ctx = getContext();
    const bus = getVoiceBus();
    if (buffer && ctx && bus) {
      const play = () => {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(bus);
        src.onended = () => finish(token);
        p.source = src;
        src.start();
      };
      if (ctx.state === 'running') {
        play();
        return;
      }
      // the context is being resumed (e.g. right after leaving the pause menu): wait briefly,
      // but drop the line rather than play it late
      const onState = () => {
        if (ctx.state !== 'running') return;
        ctx.removeEventListener('statechange', onState);
        if (p.timer) clearTimeout(p.timer);
        p.timer = undefined;
        if (current === p) play();
      };
      ctx.addEventListener('statechange', onState);
      p.timer = window.setTimeout(() => {
        ctx.removeEventListener('statechange', onState);
        finish(token);
      }, 2500);
    } else {
      speakFallback(p, () => finish(token));
    }
  });
}

/** Decides what happens to a new line given what is playing and queued (pure, for tests). */
export function decide(
  incoming: Priority,
  playing: Priority | null,
  queued: number,
): 'interrupt' | 'replace' | 'enqueue' | 'drop' | 'play' {
  if (incoming === 'high') return 'interrupt';
  if (playing === null && queued === 0) return 'play';
  if (incoming === 'low') return 'drop';
  if (playing !== null && RANK[incoming] > RANK[playing]) return 'replace';
  return 'enqueue';
}

/** Plays a line for a speaker in the current language. */
export function say(speaker: Speaker, id: LineId, priority: Priority = 'normal'): void {
  if (muted) return;
  const item: Item = { lang, speaker, id, priority, queuedAt: now() };
  switch (decide(priority, current?.item.priority ?? null, queue.length)) {
    case 'interrupt':
      stopVoice();
      start(item);
      break;
    case 'replace':
      stopCurrent();
      queue = queue.filter((q) => RANK[q.priority] >= RANK[priority]);
      start(item);
      break;
    case 'enqueue':
      queue.push(item);
      if (!current) playNext();
      break;
    case 'play':
      start(item);
      break;
    case 'drop':
      break;
  }
}

/** Stops the current line and forgets everything queued (pause, quit, unmount). */
export function stopVoice(): void {
  queue = [];
  stopCurrent();
}

/** True while a line is playing or waiting. */
export function isVoiceBusy(): boolean {
  return current !== null || queue.length > 0;
}
