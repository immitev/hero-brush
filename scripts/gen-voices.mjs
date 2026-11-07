#!/usr/bin/env node
/**
 * Build-time voice generation with Azure Speech neural TTS.
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
 * The key is never printed, logged or written anywhere.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildJobs, buildManifest, isRetryable, planJobs, resolveKey, retryDelayMs, staleFiles } from './voicegen-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'voice');
const manifestPath = join(outDir, 'manifest.json');
const MIN_GAP_MS = 3200; // F0 tier: 20 requests per 60 s
const MAX_ATTEMPTS = 6;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const lines = readJson(join(root, 'src', 'voice', 'lines.json'));
const voices = readJson(join(root, 'src', 'voice', 'voices.json'));
const jobs = buildJobs(lines, voices);

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

  const { key, source } = resolveKey();
  if (!key) {
    writeManifest(fresh);
    console.warn(`\nvoices: WARNING no Azure Speech key (${source}); ${todo.length} of ${jobs.length} lines are missing or out of date:`);
    for (const j of todo) console.warn(`  - ${j.lang}/${j.speaker}/${j.lineId}: "${j.text}"`);
    console.warn('voices: the game will use the browser speech synthesis for these lines. Set AZURE_SPEECH_KEY or create the key file and run `npm run voices`.\n');
    return;
  }

  const region = process.env.AZURE_SPEECH_REGION || 'eastus';
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  console.log(`voices: generating ${todo.length} of ${jobs.length} lines via Azure (${region}, key from ${source.startsWith('file') ? 'key file' : 'environment'})`);

  const present = [...fresh];
  const failed = [];
  let textChars = 0;
  let ssmlChars = 0;
  let lastStart = 0;
  for (const [i, j] of todo.entries()) {
    let done = false;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !done; attempt++) {
      const wait = lastStart + MIN_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastStart = Date.now();
      let res;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': key,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'hero-brush-voicegen',
          },
          body: j.ssml,
        });
      } catch (err) {
        const ms = retryDelayMs(attempt);
        console.warn(`voices: network error for ${j.file} (${err?.code ?? err?.name ?? 'error'}), retry in ${ms} ms`);
        await sleep(ms);
        continue;
      }
      textChars += j.text.length;
      ssmlChars += j.ssml.length;
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
        console.log(`voices: [${i + 1}/${todo.length}] ${j.file} (${(buf.length / 1024).toFixed(1)} KB, ~${(buf.length / 6000).toFixed(1)} s)`);
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

  console.log(`voices: done. ${present.length}/${jobs.length} lines available; sent ${textChars} text characters (${ssmlChars} SSML characters).`);
  if (failed.length) {
    console.warn(`voices: WARNING ${failed.length} lines failed and will fall back to speech synthesis:`);
    for (const j of failed) console.warn(`  - ${j.file}`);
  }
}

main().catch((err) => {
  // never fail the build because of voice generation
  console.warn(`voices: WARNING generation aborted: ${err?.message ?? err}`);
});
