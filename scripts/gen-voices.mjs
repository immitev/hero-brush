#!/usr/bin/env node
/**
 * Build-time voice generation with Azure Speech neural TTS and ElevenLabs (a speaker whose
 * voices.json entry has "provider": "elevenlabs").
 *
 * Reads src/voice/lines.json (texts per speaker/line/language) and src/voice/voices.json (voice +
 * prosody per language/speaker), and writes public/voice/<lang>/<speaker>/<lineId>.mp3 plus
 * public/voice/manifest.json. Only lines whose SSML hash changed (or whose file is missing) are
 * requested; files of lines that no longer exist are deleted.
 *
 * Key: env AZURE_SPEECH_KEY, else the file at AZURE_SPEECH_KEY_FILE, else ~/.pygmy-speech-key.
 * Region: env AZURE_SPEECH_REGION (default eastus). Without a key the script never fails the
 * build: it reports missing lines and the game falls back to speechSynthesis for them.
 *
 * ElevenLabs key: env ELEVENLABS_API_KEY, else the file at ELEVENLABS_API_KEY_FILE, else
 * ~/.elevenlabs-key.
 *
 * The keys are never printed, logged or written anywhere.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJobs, buildManifest, isRetryable, planJobs, resolveElevenKey, resolveKey, retryDelayMs, staleFiles } from './voicegen-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice');
const manifestPath = join(outDir, 'manifest.json');
const MIN_GAP_MS = { azure: 3200, elevenlabs: 600 }; // Azure F0 tier: 20 requests per 60 s
const MAX_ATTEMPTS = 6;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = readJson(join(root, 'src', 'voice', 'lines.json'));
const voices = readJson(join(root, 'src', 'voice', 'voices.json'));
const { _comment, ...stress } = readJson(join(root, 'src', 'voice', 'stress.json'));
const jobs = buildJobs(lines, voices, stress);

let previous = {};
try {
  previous = readJson(manifestPath);
} catch {
  previous = {};
}

const fileExists = (f) => existsSync(join(outDir, f));
const { fresh, todo } = planJobs(jobs, previous, fileExists);

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(relative(outDir, p).split(sep).join('/'));
  }
  return out;
}

function removeStale() {
  for (const f of staleFiles(listFiles(outDir), jobs)) {
    rmSync(join(outDir, f));
    console.log(`voices: removed stale ${f}`);
  }
  // drop empty directories
  for (const lang of existsSync(outDir) ? readdirSync(outDir, { withFileTypes: true }) : []) {
    if (!lang.isDirectory()) continue;
    const ld = join(outDir, lang.name);
    for (const spk of readdirSync(ld, { withFileTypes: true })) {
      const sd = join(ld, spk.name);
      if (spk.isDirectory() && readdirSync(sd).length === 0) rmSync(sd, { recursive: true });
    }
    if (readdirSync(ld).length === 0) rmSync(ld, { recursive: true });
  }
}

function writeManifest(present) {
  mkdirSync(outDir, { recursive: true });
  const text = JSON.stringify(buildManifest(present), null, 2) + '\n';
  const old = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : '';
  if (old !== text) writeFileSync(manifestPath, text);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  removeStale();
  if (todo.length === 0) {
    writeManifest(fresh);
    console.log(`voices: all ${jobs.length} lines up to date`);
    return;
  }

  const keys = { azure: resolveKey(), elevenlabs: resolveElevenKey() };
  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const request = {
    azure: (j, key) =>
      fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'hero-brush-voicegen',
        },
        body: j.body,
      }),
    elevenlabs: (j, key) =>
      fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(j.voice)}?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
        body: j.body,
      }),
  };

  const runnable = todo.filter((j) => keys[j.provider].key);
  const skipped = todo.filter((j) => !keys[j.provider].key);
  if (skipped.length) {
    console.warn(`\nvoices: WARNING no key for ${[...new Set(skipped.map((j) => j.provider))].join(', ')}; ${skipped.length} of ${jobs.length} lines are missing or out of date:`);
    for (const j of skipped) console.warn(`  - ${j.lang}/${j.speaker}/${j.lineId} (${j.provider}, ${keys[j.provider].source}): "${j.text}"`);
    console.warn('voices: the game will use the browser speech synthesis for these lines. Create the key file(s) and run `npm run voices`.\n');
  }
  if (runnable.length === 0) {
    writeManifest(fresh);
    return;
  }
  const via = [...new Set(runnable.map((j) => j.provider))].join(' + ');
  console.log(`voices: generating ${runnable.length} of ${jobs.length} lines via ${via}`);

  const present = [...fresh];
  const failed = [];
  let textChars = 0;
  const lastStart = { azure: 0, elevenlabs: 0 };
  for (const [i, j] of runnable.entries()) {
    let done = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
      const wait = lastStart[j.provider] + MIN_GAP_MS[j.provider] - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart[j.provider] = Date.now();
      let res;
      try {
        res = await request[j.provider](j, keys[j.provider].key);
      } catch (err) {
        const ms = retryDelayMs(attempt);
        console.warn(`voices: network error for ${j.file} (${err?.code ?? err?.name ?? 'error'}), retry in ${ms} ms`);
        await sleep(ms);
        continue;
      }
      textChars += j.text.length;
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) {
          console.warn(`voices: ${j.file} returned only ${buf.length} bytes, skipping`);
          break;
        }
        const target = join(outDir, j.file);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, buf);
        present.push(j);
        done = true;
        console.log(`voices: [${i + 1}/${runnable.length}] ${j.file} via ${j.provider} (${(buf.length / 1024).toFixed(1)} KB)`);
      } else if (isRetryable(res.status) && attempt < MAX_ATTEMPTS) {
        const ms = retryDelayMs(attempt, res.headers.get('retry-after'));
        console.warn(`voices: HTTP ${res.status} for ${j.file}, retry in ${ms} ms`);
        await res.arrayBuffer().catch(() => undefined);
        await sleep(ms);
      } else {
        const body = (await res.text().catch(() => '')).slice(0, 200);
        console.warn(`voices: HTTP ${res.status} for ${j.file}: ${body}`);
        break;
      }
    }
    if (!done) failed.push(j);
    // keep the manifest consistent even if the run is interrupted
    writeManifest(present);
  }

  console.log(`voices: done. ${present.length}/${jobs.length} lines available; sent ${textChars} text characters.`);
  if (failed.length) {
    console.warn(`voices: WARNING ${failed.length} lines failed and will fall back to speech synthesis:`);
    for (const j of failed) console.warn(`  - ${j.file}`);
  }
}

main().catch((err) => {
  // never fail the build because of voice generation
  console.warn(`voices: WARNING generation aborted: ${err?.message ?? err}`);
});
