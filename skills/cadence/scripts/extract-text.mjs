#!/usr/bin/env node
/**
 * Extract plain prose from a sample file so /cadence learn can profile it.
 *
 *   node extract-text.mjs <file.pdf|.txt|.md>   → prose on stdout
 *
 * .txt / .md are read directly. .pdf is parsed with a small pure-Node extractor
 * that uses only the built-in `zlib` — no pip packages, no native deps. It works
 * on any machine that has Node, and handles the common case (FlateDecode or
 * uncompressed content streams, literal and hex strings). PDFs built entirely
 * from custom-encoded subset fonts may extract imperfectly; convert those to
 * .txt first.
 */
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import zlib from 'node:zlib';
import { stripHtml } from './deslop.mjs';

// ─── stream handling ────────────────────────────────────────────────────────
function tryInflate(bytes) {
  const opts = { finishFlush: zlib.constants.Z_SYNC_FLUSH };
  for (const fn of [zlib.inflateSync, zlib.inflateRawSync]) {
    try { const out = fn(bytes, opts); if (out && out.length) return out; } catch { /* try next */ }
  }
  return null;
}

// Walk the file for `stream … endstream` blocks, keeping each one's preceding
// dictionary text (to read the /Filter) and its raw bytes.
function findStreams(buf) {
  const s = buf.toString('latin1');
  const streams = [];
  let i = 0;
  while (true) {
    const k = s.indexOf('stream', i);
    if (k < 0) break;
    let p = k + 6;
    if (s[p] === '\r') p++;
    if (s[p] === '\n') p++;
    const e = s.indexOf('endstream', p);
    if (e < 0) break;
    streams.push({ dict: s.slice(Math.max(0, k - 500), k), raw: buf.subarray(p, e) });
    i = e + 9;
  }
  return streams;
}

function decodeStream(st) {
  if (/\/FlateDecode/.test(st.dict)) {
    const out = tryInflate(st.raw);
    return out ? out.toString('latin1') : null;
  }
  if (!/\/Filter/.test(st.dict)) return st.raw.toString('latin1'); // uncompressed
  return null; // other filters (image codecs, etc.) — not text
}

// ─── content-stream text extraction ─────────────────────────────────────────
const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };

function decodeLiteral(str) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c !== '\\') { out += c; continue; }
    const next = str[i + 1];
    if (next >= '0' && next <= '7') {
      let oct = next; i++;
      while (oct.length < 3 && str[i + 1] >= '0' && str[i + 1] <= '7') oct += str[++i];
      out += String.fromCharCode(parseInt(oct, 8) & 0xff);
    } else if (next in ESCAPES) { out += ESCAPES[next]; i++; }
    else if (next === '\n') { i++; } // line continuation
    else if (next === '\r') { i++; if (str[i + 1] === '\n') i++; }
    else { out += next ?? ''; i++; }
  }
  return out;
}

function decodeHex(hex) {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  for (let i = 0; i + 1 < clean.length; i += 2) out += String.fromCharCode(parseInt(clean.substr(i, 2), 16));
  if (clean.length % 2) out += String.fromCharCode(parseInt(clean[clean.length - 1] + '0', 16));
  return out;
}

// Pull readable text out of one decoded content stream: collect the strings
// shown by Tj / TJ / ' / " and break lines on text-positioning operators.
// Typeset PDFs separate words with TJ kerning rather than space characters, so a
// large negative adjustment inside a [ … ] TJ array becomes a space.
const WORD_GAP = -110; // kerning more negative than this reads as a word break

function textFromContent(content) {
  const n = content.length;
  let i = 0;
  let out = '';
  const readLiteral = (start) => {
    let depth = 1, j = start + 1, str = '';
    while (j < n && depth > 0) {
      const ch = content[j];
      if (ch === '\\') { str += ch + (content[j + 1] ?? ''); j += 2; continue; }
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      str += ch; j++;
    }
    return [decodeLiteral(str), j + 1];
  };
  const readHex = (start) => {
    const end = content.indexOf('>', start);
    if (end < 0) return ['', n];
    return [decodeHex(content.slice(start + 1, end)), end + 1];
  };
  while (i < n) {
    const c = content[i];
    if (c === '(') { const [s, ni] = readLiteral(i); out += s; i = ni; }
    else if (c === '<' && content[i + 1] !== '<') { const [s, ni] = readHex(i); out += s; i = ni; }
    else if (c === '[') {
      let j = i + 1;
      while (j < n && content[j] !== ']') {
        const ch = content[j];
        if (ch === '(') { const [s, ni] = readLiteral(j); out += s; j = ni; }
        else if (ch === '<') { const [s, ni] = readHex(j); out += s; j = ni; }
        else if (ch === '-' || (ch >= '0' && ch <= '9')) {
          let num = ch; j++;
          while (j < n && /[0-9.]/.test(content[j])) num += content[j++];
          if (parseFloat(num) < WORD_GAP && !out.endsWith(' ')) out += ' ';
        } else j++;
      }
      i = j + 1;
    }
    else if (c === 'T' && (content[i + 1] === 'd' || content[i + 1] === 'D' || content[i + 1] === '*')) { out += '\n'; i += 2; }
    else if (c === "'" || c === '"') { out += '\n'; i++; }
    else i++;
  }
  return out;
}

// Guard against custom-encoded subset fonts that decode to letter-shifted
// nonsense. In real English, function words are a large fraction of all tokens;
// in shifted garbage they almost never line up, so the rate collapses.
const FUNCTION_WORDS = new Set([
  'the', 'and', 'of', 'to', 'in', 'that', 'is', 'for', 'it', 'with', 'as', 'was',
  'on', 'be', 'this', 'by', 'an', 'are', 'at', 'from', 'or', 'we', 'you', 'not',
  'but', 'have', 'has', 'they', 'their', 'which', 'a',
]);

function looksReadable(text) {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];
  if (words.length < 30) return false;
  const hits = words.reduce((n, w) => n + (FUNCTION_WORDS.has(w) ? 1 : 0), 0);
  return hits / words.length > 0.12; // English runs ~25-40%; garbage ≈ 0
}

function extractPdf(buf) {
  const pieces = [];
  for (const st of findStreams(buf)) {
    const content = decodeStream(st);
    if (!content) continue;
    if (!/(Tj|TJ|BT)\b/.test(content) && content.indexOf('(') < 0) continue;
    const t = textFromContent(content);
    if (t.trim()) pieces.push(t);
  }
  return pieces.join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ─── CLI ────────────────────────────────────────────────────────────────────
function main() {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write('usage: node extract-text.mjs <file.pdf|.txt|.md|.html>\n');
    process.exit(2);
  }
  const ext = extname(file).toLowerCase();
  if (ext === '.txt' || ext === '.md' || ext === '') {
    process.stdout.write(readFileSync(file, 'utf8'));
  } else if (ext === '.html' || ext === '.htm') {
    const text = stripHtml(readFileSync(file, 'utf8'));
    if (!text || text.replace(/\s/g, '').length < 20) {
      process.stderr.write('No readable text found in this HTML file.\n');
      process.exit(3);
    }
    process.stdout.write(text + '\n');
  } else if (ext === '.pdf') {
    const text = extractPdf(readFileSync(file));
    if (!text || text.replace(/\s/g, '').length < 20 || !looksReadable(text)) {
      process.stderr.write('Could not extract readable text from this PDF ' +
        '(it may be scanned images or use custom-encoded subset fonts). ' +
        'Convert it to .txt and try again.\n');
      process.exit(3);
    }
    process.stdout.write(text + '\n');
  } else {
    process.stderr.write(`Unsupported file type: ${ext}. Use .pdf, .txt, .md, or .html, ` +
      'or paste the text directly.\n');
    process.exit(2);
  }
}

// Run as CLI unless imported by a test.
if (import.meta.url === `file://${process.argv[1]}`) main();

export { extractPdf, decodeLiteral, decodeHex, textFromContent, looksReadable };
