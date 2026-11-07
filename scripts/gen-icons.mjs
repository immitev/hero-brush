// Generates PWA icons (PNG + SVG) with zero dependencies.
// Draws a simple original design: a rounded tooth with a cape and a star on a purple circle.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// --- tiny PNG encoder -------------------------------------------------------
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- simple rasteriser ------------------------------------------------------
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4);
  const px = (x, y, [r, g, b, a = 1]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const ia = 1 - a;
    buf[i] = Math.round(r * a + buf[i] * ia);
    buf[i + 1] = Math.round(g * a + buf[i + 1] * ia);
    buf[i + 2] = Math.round(b * a + buf[i + 2] * ia);
    buf[i + 3] = Math.round(Math.min(255, 255 * a + buf[i + 3] * ia));
  };
  const fill = (test, color) => {
    // 4x supersampling for soft edges
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      let hit = 0;
      for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
        if (test((x + 0.25 + sx * 0.5) / size, (y + 0.25 + sy * 0.5) / size)) hit++;
      }
      if (hit) px(x, y, [color[0], color[1], color[2], (color[3] ?? 1) * hit / 4]);
    }
  };
  return { buf, fill };
}

function drawIcon(size, { maskable }) {
  const c = makeCanvas(size);
  const bg = [27, 19, 64];
  if (maskable) {
    c.fill(() => true, bg);
  } else {
    c.fill((u, v) => (u - 0.5) ** 2 + (v - 0.5) ** 2 < 0.5 ** 2, bg);
  }
  // scale content for maskable safe zone
  const s = maskable ? 0.8 : 0.92;
  const T = (u, v) => [(u - 0.5) / s + 0.5, (v - 0.5) / s + 0.5];
  const inside = (test) => (u, v) => { const [a, b] = T(u, v); return test(a, b); };

  // glow ring
  c.fill(inside((u, v) => { const d = Math.hypot(u - 0.5, v - 0.5); return d > 0.40 && d < 0.46; }), [255, 196, 61, 0.9]);

  // cape (red) behind tooth
  c.fill(inside((u, v) => {
    const x = u - 0.5, y = v - 0.5;
    return y > -0.18 && y < 0.36 && Math.abs(x) < 0.17 + (y + 0.18) * 0.55 && (y < 0.3 || Math.abs(Math.sin(x * 40)) > 0.3);
  }), [230, 57, 70]);

  // tooth crown: rounded blob
  const crown = (u, v) => {
    const x = (u - 0.5) / 0.26, y = (v - 0.43) / 0.22;
    return x * x * x * x + y * y < 1;
  };
  // roots: two rounded cones
  const root = (cx) => (u, v) => {
    const x = (u - cx) / 0.09, y = (v - 0.62) / 0.2;
    return y > -0.2 && y < 1 && x * x < (1 - y * 0.75) ** 2;
  };
  c.fill((u, v) => crown(...T(u, v)) || root(0.405)(...T(u, v)) || root(0.595)(...T(u, v)), [250, 250, 255]);
  // shading on tooth
  c.fill((u, v) => { const [a, b] = T(u, v); return (crown(a, b)) && (a - 0.5) * 0.7 + (b - 0.43) > 0.1; }, [200, 210, 235, 0.5]);
  // eye mask (dark blue band) -> hero look
  c.fill(inside((u, v) => {
    const x = u - 0.5, y = v - 0.42;
    return Math.abs(y) < 0.045 + Math.abs(x) * 0.08 && Math.abs(x) < 0.2 && !(Math.hypot((x + 0.08) / 1.2, y) < 0.03) && !(Math.hypot((x - 0.08) / 1.2, y) < 0.03);
  }), [40, 50, 120]);
  // smile
  c.fill(inside((u, v) => {
    const x = u - 0.5, y = v - 0.5;
    const d = Math.hypot(x / 1.2, y - 0.0);
    return d > 0.085 && d < 0.11 && y > 0.03;
  }), [40, 50, 120]);
  // star sparkle top-right
  c.fill(inside((u, v) => {
    const x = u - 0.78, y = v - 0.24;
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x);
    return r < 0.03 + 0.06 * Math.max(0, Math.cos(a * 2) ** 2) ** 2 * (Math.abs(Math.cos(a * 2)) > 0.9 ? 1 : 0.2);
  }), [255, 230, 120]);
  return encodePNG(size, size, c.buf);
}

const sizes = [192, 512];
for (const sz of sizes) writeFileSync(join(outDir, `icon-${sz}.png`), drawIcon(sz, { maskable: false }));
writeFileSync(join(outDir, 'icon-maskable-512.png'), drawIcon(512, { maskable: true }));
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180, { maskable: true }));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<circle cx="50" cy="50" r="50" fill="#1b1340"/>
<circle cx="50" cy="50" r="43" fill="none" stroke="#ffc43d" stroke-width="5"/>
<path d="M33 36 L67 36 L78 78 L50 70 L22 78 Z" fill="#e63946"/>
<path d="M50 20 C68 20 76 32 74 44 C72 54 66 56 62 72 C60 80 54 80 52 70 C51 66 49 66 48 70 C46 80 40 80 38 72 C34 56 28 54 26 44 C24 32 32 20 50 20 Z" fill="#fafaff"/>
<path d="M31 42 Q50 36 69 42 L68 48 Q50 44 32 48 Z" fill="#283278"/>
<circle cx="42" cy="44" r="2.5" fill="#fff"/><circle cx="58" cy="44" r="2.5" fill="#fff"/>
<path d="M41 56 Q50 63 59 56" stroke="#283278" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M78 20 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" fill="#ffe678"/>
</svg>`;
writeFileSync(join(outDir, 'icon.svg'), svg);
console.log('icons written to', outDir);
