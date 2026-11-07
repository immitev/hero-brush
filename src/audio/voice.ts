/** Voice prompts via the Web Speech API (no audio files). */
let muted = false;
let preferred: SpeechSynthesisVoice | null = null;

export function setVoiceMuted(v: boolean): void {
  muted = v;
  if (v && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  if (preferred) return preferred;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice) =>
    (v.localService ? 2 : 0) + (/natural|neural|google|samantha|zira|aria|jenny/i.test(v.name) ? 1 : 0) + (v.default ? 0.5 : 0);
  preferred = (en.length ? en : voices).sort((a, b) => score(b) - score(a))[0] ?? null;
  return preferred;
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => {
    preferred = null;
    pickVoice();
  });
}

export function speak(text: string, opts: { interrupt?: boolean; pitch?: number; rate?: number } = {}): void {
  if (muted || typeof speechSynthesis === 'undefined' || !text) return;
  try {
    if (opts.interrupt !== false) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-US';
    u.rate = opts.rate ?? 1.02;
    u.pitch = opts.pitch ?? 1.15;
    u.volume = 1;
    speechSynthesis.speak(u);
  } catch {
    /* speech unavailable */
  }
}

export function stopSpeaking(): void {
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
}
