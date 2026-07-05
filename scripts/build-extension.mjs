#!/usr/bin/env node
/**
 * Build the browser assets for the Cadence Chrome extension:
 *   - extension/detector.js : the detector, generated from the single source
 *     (skills/cadence/scripts/deslop.mjs) so it can never drift.
 *   - extension/icons/*.png : the rhythm-bars logo, rendered with a tiny pure-Node
 *     PNG encoder (built-in zlib only, no dependencies).
 *
 * Run:  node scripts/build-extension.mjs   (or: npm run build:extension)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import zlib from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname;

// ─── 1. detector.js (generated from deslop.mjs) ─────────────────────────────
function buildDetector() {
  const src = readFileSync(ROOT + 'skills/cadence/scripts/deslop.mjs', 'utf8');
  const start = src.indexOf('// ─── Lexical rules');
  const end = src.indexOf('// ─── repo / directory scan');
  if (start < 0 || end < 0) throw new Error('deslop.mjs markers not found. Did the file structure change?');
  const core = src.slice(start, end).replace(/^export /gm, '').trim();
  const out =
`// AUTO-GENERATED from skills/cadence/scripts/deslop.mjs. Do not edit by hand.
// Regenerate with: npm run build:extension
(function (global) {
${core}
  global.cadenceAnalyze = analyze;
  global.cadenceAnalyzeParagraphs = analyzeParagraphs;
})(typeof window !== 'undefined' ? window : globalThis);
`;
  writeFileSync(ROOT + 'extension/detector.js', out);
  return out.length;
}

// ─── 2. PNG icons (pure-Node encoder) ───────────────────────────────────────
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// the logo, in a 200×200 space: x, y, width, height, [r,g,b]
const INDIGO = [0x23, 0x48, 0xa1], RED = [0xdb, 0x33, 0x2c];
const BARS = [
  [21, 51, 22, 107, INDIGO], [55, 96, 22, 62, INDIGO], [89, 38, 22, 120, INDIGO],
  [123, 68, 22, 90, RED], [157, 108, 22, 50, INDIGO],
];
function renderIcon(size) {
  const f = size / 200;
  const rgba = Buffer.alloc(size * size * 4); // transparent
  for (const [bx, by, bw, bh, col] of BARS) {
    const x0 = Math.round(bx * f), y0 = Math.round(by * f);
    const x1 = Math.round((bx + bw) * f), y1 = Math.round((by + bh) * f);
    const r = (x1 - x0) / 2; // rounded caps
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        // round the top/bottom caps
        const cx = (x0 + x1) / 2;
        const dTop = y0 + r - y, dBot = y - (y1 - r);
        if (dTop > 0 && Math.hypot(x - cx + 0.5, dTop) > r) continue;
        if (dBot > 0 && Math.hypot(x - cx + 0.5, dBot) > r) continue;
        const i = (y * size + x) * 4;
        rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2]; rgba[i + 3] = 255;
      }
    }
  }
  return png(size, size, rgba);
}

// ─── run ────────────────────────────────────────────────────────────────────
mkdirSync(ROOT + 'extension/icons', { recursive: true });
const bytes = buildDetector();
for (const size of [16, 48, 128]) writeFileSync(ROOT + `extension/icons/icon-${size}.png`, renderIcon(size));
process.stdout.write(`built extension/detector.js (${bytes} bytes) and icons 16/48/128\n`);
