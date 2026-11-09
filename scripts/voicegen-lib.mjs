/**
 * Pure helpers for scripts/gen-voices.mjs (kept separate so they can be unit tested).
 * Nothing in here touches the network; nothing in here ever logs the key.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Decodes the raw bytes of a key file. Handles ANSI/UTF-8 (with or without BOM) and
 * UTF-16 LE/BE with BOM (what Windows PowerShell may write), and strips all whitespace
 * (trailing CRLF, spaces, stray NULs).
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function decodeKeyFile(bytes) {
  const b = Buffer.from(bytes);
  let text;
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    text = b.subarray(2).toString('utf16le');
  } else if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    const swapped = Buffer.from(b.subarray(2));
    swapped.swap16();
    text = swapped.toString('utf16le');
  } else if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    text = b.subarray(3).toString('utf8');
  } else {
    text = b.toString('latin1');
  }
  return text.replace(/^﻿/, '').replace(/[\s\u0000]+/g, '');
}

/**
 * Finds the Azure Speech key without ever printing it.
 * Order: AZURE_SPEECH_KEY, then the file at AZURE_SPEECH_KEY_FILE, then ~/.pygmy-speech-key.
 * @returns {{ key: string | null, source: string }}
 */
export function resolveKey(env = process.env, readFile = readFileSync, home = homedir()) {
  const direct = (env.AZURE_SPEECH_KEY ?? '').trim();
  if (direct) return { key: direct, source: 'env AZURE_SPEECH_KEY' };
  const path = env.AZURE_SPEECH_KEY_FILE || join(home, '.pygmy-speech-key');
  try {
    const key = decodeKeyFile(readFile(path));
    if (key) return { key, source: `file ${path}` };
    return { key: null, source: `file ${path} is empty` };
  } catch {
    return { key: null, source: `no key file at ${path}` };
  }
}

/** @param {string} s */
export function escapeXml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
}

/**
 * @typedef {{ voice: string, locale?: string, style?: string, styledegree?: number, rate?: string, pitch?: string }} VoiceSpec
 */

/**
 * Builds the SSML for one line. `xmlLang` is the document language (en-US / bg-BG). When the
 * voice's own locale differs (a multilingual voice speaking another language) the text is
 * wrapped in <lang>.
 * @param {VoiceSpec} spec
 * @param {string} text
 * @param {string} xmlLang
 * @param {{ leading?: string, tailing?: string }} [silence] exact leading / trailing silence (keeps short prompts snappy)
 */
export function buildSsml(spec, text, xmlLang, silence) {
  let inner = escapeXml(text);
  if (spec.rate || spec.pitch) {
    const attrs = [spec.rate ? ` rate="${escapeXml(spec.rate)}"` : '', spec.pitch ? ` pitch="${escapeXml(spec.pitch)}"` : ''].join('');
    inner = `<prosody${attrs}>${inner}</prosody>`;
  }
  if (spec.locale && spec.locale !== xmlLang) inner = `<lang xml:lang="${escapeXml(xmlLang)}">${inner}</lang>`;
  if (spec.style) {
    const deg = spec.styledegree ? ` styledegree="${spec.styledegree}"` : '';
    inner = `<mstts:express-as style="${escapeXml(spec.style)}"${deg}>${inner}</mstts:express-as>`;
  }
  const sil = [
    silence?.leading ? `<mstts:silence type="Leading-exact" value="${escapeXml(silence.leading)}"/>` : '',
    silence?.tailing ? `<mstts:silence type="Tailing-exact" value="${escapeXml(silence.tailing)}"/>` : '',
  ].join('');
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="${escapeXml(xmlLang)}">` +
    `<voice name="${escapeXml(spec.voice)}">${sil}${inner}</voice></speak>`
  );
}

/** sha256 of voice name + full SSML. */
export function lineHash(voiceName, ssml) {
  return createHash('sha256').update(`${voiceName}\n${ssml}`).digest('hex');
}

const VOWELS = 'аеиоуъюяѝ';

/**
 * Marks word stress for the TTS engine: every word found in `dict` (lower-case word -> the same
 * word with its stressed vowel in upper case) gets a combining acute accent (U+0301) after that
 * vowel. The original capitalisation is kept. Unknown words are left alone.
 * @param {string} text
 * @param {Record<string, string> | undefined} dict
 */
export function applyStress(text, dict) {
  if (!dict) return text;
  return text.replace(/\p{L}+/gu, (word) => {
    const marked = dict[word.toLowerCase()];
    if (!marked) return word;
    let out = '';
    for (let i = 0; i < word.length; i++) {
      out += word[i];
      const m = marked[i];
      if (m && m !== m.toLowerCase() && VOWELS.includes(m.toLowerCase())) out += '́';
    }
    return out;
  });
}

/**
 * Expands lines.json + voices.json into one job per (lang, speaker, line).
 * @param {Record<string, Record<string, Record<string, string>>>} lines speaker -> lineId -> lang -> text
 * @param {{ languages: Record<string, { xmlLang: string, silence?: { leading?: string, tailing?: string }, speakers: Record<string, VoiceSpec> }> }} voices
 * @param {Record<string, Record<string, string>>} [stress] lang -> stress dictionary (see applyStress)
 */
export function buildJobs(lines, voices, stress = {}) {
  const jobs = [];
  for (const [lang, cfg] of Object.entries(voices.languages)) {
    for (const [speaker, byId] of Object.entries(lines)) {
      const spec = cfg.speakers[speaker];
      if (!spec) throw new Error(`voices.json: no ${lang} voice for speaker "${speaker}"`);
      for (const [lineId, texts] of Object.entries(byId)) {
        const text = texts[lang];
        if (!text || !text.trim()) throw new Error(`lines.json: ${speaker}.${lineId} has no ${lang} text`);
        const ssml = buildSsml(spec, applyStress(text, stress[lang]), cfg.xmlLang, cfg.silence);
        jobs.push({
          lang,
          speaker,
          lineId,
          text,
          voice: spec.voice,
          ssml,
          hash: lineHash(spec.voice, ssml),
          file: `${lang}/${speaker}/${lineId}.mp3`,
        });
      }
    }
  }
  return jobs;
}

/**
 * Splits jobs into the ones that are already cached (file exists, manifest hash matches)
 * and the ones that need a request.
 * @param {ReturnType<typeof buildJobs>} jobs
 * @param {any} manifest previous manifest (lang -> speaker -> lineId -> { file, hash })
 * @param {(file: string) => boolean} fileExists
 */
export function planJobs(jobs, manifest, fileExists) {
  const fresh = [];
  const todo = [];
  for (const j of jobs) {
    const prev = manifest?.[j.lang]?.[j.speaker]?.[j.lineId];
    if (prev && prev.hash === j.hash && prev.file === j.file && fileExists(j.file)) fresh.push(j);
    else todo.push(j);
  }
  return { fresh, todo };
}

/** Builds the manifest object for the given (successfully present) jobs, with sorted keys. */
export function buildManifest(jobs) {
  const sorted = [...jobs].sort((a, b) => `${a.lang}/${a.speaker}/${a.lineId}`.localeCompare(`${b.lang}/${b.speaker}/${b.lineId}`));
  const m = {};
  for (const j of sorted) {
    m[j.lang] ??= {};
    m[j.lang][j.speaker] ??= {};
    m[j.lang][j.speaker][j.lineId] = { file: j.file, hash: j.hash };
  }
  return m;
}

/**
 * Files on disk (relative, forward slashes) that are not referenced by any job: lines that
 * were removed or renamed. Files of jobs that are merely out of date are kept.
 * @param {string[]} filesOnDisk
 * @param {ReturnType<typeof buildJobs>} jobs
 */
export function staleFiles(filesOnDisk, jobs) {
  const wanted = new Set(jobs.map((j) => j.file));
  return filesOnDisk.filter((f) => f.endsWith('.mp3') && !wanted.has(f));
}

/** Delay in ms before retry number `attempt` (1-based), honouring Retry-After (seconds or HTTP date). */
export function retryDelayMs(attempt, retryAfter, now = Date.now()) {
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs) && secs >= 0) return Math.min(60_000, Math.max(1000, secs * 1000));
    const at = Date.parse(retryAfter);
    if (Number.isFinite(at)) return Math.min(60_000, Math.max(1000, at - now));
  }
  return Math.min(60_000, 4000 * 2 ** (attempt - 1));
}

/** True for responses worth retrying. */
export function isRetryable(status) {
  return status === 429 || status === 408 || status >= 500;
}
