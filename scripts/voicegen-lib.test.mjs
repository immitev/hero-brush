import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import {
  buildJobs,
  buildManifest,
  buildSsml,
  decodeKeyFile,
  escapeXml,
  isRetryable,
  lineHash,
  planJobs,
  resolveKey,
  retryDelayMs,
  staleFiles,
} from './voicegen-lib.mjs';

const KEY = 'AbC123def456';

describe('decodeKeyFile', () => {
  it('handles ANSI with trailing CRLF', () => {
    expect(decodeKeyFile(Buffer.from(`${KEY}\r\n`, 'latin1'))).toBe(KEY);
  });
  it('handles UTF-8 with BOM', () => {
    expect(decodeKeyFile(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(`${KEY}\r\n`)]))).toBe(KEY);
  });
  it('handles UTF-16 LE with BOM', () => {
    expect(decodeKeyFile(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`${KEY}\r\n`, 'utf16le')]))).toBe(KEY);
  });
  it('handles UTF-16 BE with BOM', () => {
    const be = Buffer.from(`${KEY}\n`, 'utf16le').swap16();
    expect(decodeKeyFile(Buffer.concat([Buffer.from([0xfe, 0xff]), be]))).toBe(KEY);
  });
  it('strips surrounding whitespace and blank lines', () => {
    expect(decodeKeyFile(Buffer.from(`  ${KEY}  \r\n\r\n`))).toBe(KEY);
    expect(decodeKeyFile(Buffer.from('\r\n'))).toBe('');
  });
});

describe('resolveKey', () => {
  const reader = (files) => (p) => {
    if (!(p in files)) throw new Error('ENOENT');
    return files[p];
  };
  it('prefers AZURE_SPEECH_KEY', () => {
    expect(resolveKey({ AZURE_SPEECH_KEY: ` ${KEY} ` }, reader({}), '/home').key).toBe(KEY);
  });
  it('reads AZURE_SPEECH_KEY_FILE, else the default file', () => {
    expect(resolveKey({ AZURE_SPEECH_KEY_FILE: '/k' }, reader({ '/k': Buffer.from(`${KEY}\r\n`) }), '/home').key).toBe(KEY);
    expect(resolveKey({}, reader({ [join('/home', '.pygmy-speech-key')]: Buffer.from(KEY) }), '/home').key).toBe(KEY);
  });
  it('returns null when there is no key', () => {
    const r = resolveKey({}, reader({}), '/home');
    expect(r.key).toBeNull();
    expect(r.source).toMatch(/no key file/);
  });
});

describe('SSML', () => {
  it('escapes XML special characters', () => {
    expect(escapeXml(`a & b < c > d "e" 'f'`)).toBe('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;');
  });
  it('builds voice, style, prosody and silence', () => {
    const s = buildSsml(
      { voice: 'en-US-JennyNeural', style: 'cheerful', styledegree: 1.2, rate: '-2%', pitch: '+4%' },
      "Let's go & <win>",
      'en-US',
      { leading: '50ms' },
    );
    expect(s).toContain('xml:lang="en-US"');
    expect(s).toContain('<voice name="en-US-JennyNeural">');
    expect(s).toContain('<mstts:express-as style="cheerful" styledegree="1.2">');
    expect(s).toContain('<prosody rate="-2%" pitch="+4%">Let&apos;s go &amp; &lt;win&gt;</prosody>');
    expect(s).toContain('<mstts:silence type="Leading-exact" value="50ms"/>');
    expect(s).not.toContain('<lang');
  });
  it('wraps text in <lang> for a voice from another locale', () => {
    const s = buildSsml({ voice: 'en-US-AndrewMultilingualNeural', locale: 'en-US' }, 'Здравей', 'bg-BG');
    expect(s).toContain('xml:lang="bg-BG"');
    expect(s).toContain('<lang xml:lang="bg-BG">Здравей</lang>');
    expect(s).not.toContain('prosody');
  });
});

describe('jobs, hashing and caching', () => {
  const lines = { narrator: { go: { en: 'Go!', bg: 'Давай!' } }, hero: { hi: { en: 'Hi', bg: 'Здрасти' } } };
  const voices = {
    languages: {
      en: { xmlLang: 'en-US', speakers: { narrator: { voice: 'A' }, hero: { voice: 'B', pitch: '-10%' } } },
      bg: { xmlLang: 'bg-BG', speakers: { narrator: { voice: 'C' }, hero: { voice: 'D' } } },
    },
  };
  const jobs = buildJobs(lines, voices);
  const hashOf = (js, f) => js.find((j) => j.file === f).hash;

  it('creates one job per language, speaker and line', () => {
    expect(jobs.map((j) => j.file).sort()).toEqual(['bg/hero/hi.mp3', 'bg/narrator/go.mp3', 'en/hero/hi.mp3', 'en/narrator/go.mp3']);
  });

  it('fails loudly on a missing translation or voice', () => {
    expect(() => buildJobs({ narrator: { go: { en: 'Go!' } } }, voices)).toThrow(/no bg text/);
    expect(() => buildJobs({ other: { x: { en: 'x', bg: 'х' } } }, voices)).toThrow(/no en voice/);
  });

  it('hash depends on voice name and SSML', () => {
    expect(lineHash('A', '<x/>')).toBe(lineHash('A', '<x/>'));
    expect(lineHash('A', '<x/>')).not.toBe(lineHash('B', '<x/>'));
    expect(lineHash('A', '<x/>')).not.toBe(lineHash('A', '<y/>'));
    const changed = buildJobs({ ...lines, narrator: { go: { en: 'Go go!', bg: 'Давай!' } } }, voices);
    expect(hashOf(changed, 'en/narrator/go.mp3')).not.toBe(hashOf(jobs, 'en/narrator/go.mp3'));
    expect(hashOf(changed, 'bg/narrator/go.mp3')).toBe(hashOf(jobs, 'bg/narrator/go.mp3'));
  });

  it('only regenerates changed or missing lines', () => {
    const manifest = buildManifest(jobs);
    const all = () => true;
    expect(planJobs(jobs, manifest, all).todo).toHaveLength(0);
    expect(planJobs(jobs, {}, all).todo).toHaveLength(4);
    expect(planJobs(jobs, manifest, (f) => f !== 'en/hero/hi.mp3').todo.map((j) => j.file)).toEqual(['en/hero/hi.mp3']);
    const stale = structuredClone(manifest);
    stale.bg.narrator.go.hash = 'old';
    expect(planJobs(jobs, stale, all).todo.map((j) => j.file)).toEqual(['bg/narrator/go.mp3']);
  });

  it('builds a lang -> speaker -> line manifest', () => {
    const m = buildManifest(jobs);
    expect(Object.keys(m)).toEqual(['bg', 'en']);
    expect(m.en.hero.hi).toEqual({ file: 'en/hero/hi.mp3', hash: hashOf(jobs, 'en/hero/hi.mp3') });
  });

  it('finds files of removed lines only', () => {
    expect(staleFiles(['en/hero/hi.mp3', 'en/hero/old.mp3', 'manifest.json', 'bg/x/y.mp3'], jobs)).toEqual(['en/hero/old.mp3', 'bg/x/y.mp3']);
  });
});

describe('retries', () => {
  it('retries throttling and server errors only', () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
  });
  it('honours Retry-After and backs off exponentially', () => {
    expect(retryDelayMs(1, '7')).toBe(7000);
    expect(retryDelayMs(1, new Date(10_000).toUTCString(), 4_000)).toBe(6000);
    expect(retryDelayMs(1, null)).toBe(4000);
    expect(retryDelayMs(3, null)).toBe(16000);
    expect(retryDelayMs(10, null)).toBe(60000);
  });
});
