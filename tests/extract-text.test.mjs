import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  extractPdf, extractDocx, decodeLiteral, decodeHex, textFromContent, looksReadable,
} from '../skills/cadence/scripts/extract-text.mjs';

// A minimal uncompressed PDF — just enough structure for the stream scanner.
const MINIMAL_PDF = Buffer.from(`%PDF-1.4
4 0 obj
<< /Length 78 >>
stream
BT /F1 24 Tf 100 700 Td (The quick brown fox and the lazy dog ran with us) Tj ET
endstream
endobj
%%EOF
`, 'latin1');

test('extractPdf pulls text from an uncompressed content stream', () => {
  const out = extractPdf(MINIMAL_PDF);
  assert.match(out, /quick brown fox/);
  assert.match(out, /lazy dog ran with us/);
});

test('extractPdf returns empty for a PDF with no text streams', () => {
  const noText = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF', 'latin1');
  assert.equal(extractPdf(noText).trim(), '');
});

test('decodeLiteral handles escapes and octal', () => {
  assert.equal(decodeLiteral('a\\(b\\)c'), 'a(b)c');
  assert.equal(decodeLiteral('line\\nbreak'), 'line\nbreak');
  assert.equal(decodeLiteral('\\101\\102'), 'AB'); // octal 101=A, 102=B
});

test('decodeHex decodes hex strings', () => {
  assert.equal(decodeHex('48656c6c6f'), 'Hello');
});

test('extractDocx pulls text from a .docx (a ZIP of XML)', () => {
  const buf = readFileSync(new URL('./fixtures/sample.docx', import.meta.url));
  const out = extractDocx(buf);
  assert.match(out, /low all summer/);
  assert.match(out, /baked white in the sun/);
  assert.doesNotMatch(out, /<w:/); // no XML tags survive
});

test('textFromContent inserts a space on a wide TJ kerning gap', () => {
  assert.equal(textFromContent('[(Hello)-300(World)]TJ').trim(), 'Hello World');
});

test('textFromContent does NOT split on small (letter) kerning', () => {
  assert.equal(textFromContent('[(Hel)-20(lo)]TJ').trim(), 'Hello');
});

test('looksReadable: true for English prose', () => {
  const prose = 'The argument is that we can extract the text from a file and that '
    + 'it reads as it should for the most part with the function words in place. '
    + 'When the words are spaced correctly and the common terms appear at a normal '
    + 'rate, the guard lets the text through to the profiler so it can be measured.';
  assert.equal(looksReadable(prose), true);
});

test('looksReadable: false for letter-shifted garbage', () => {
  // "the quick brown fox..." shifted +1 per char — no real function words survive.
  const garbage = 'uif rvjdl cspxo gpy boe uif mbaz eph xjui vt sbo bdsptt uif gjfme '
    + 'boe joup uif ebsl xppet cfzpoe uif sjwfs cboL';
  assert.equal(looksReadable(garbage), false);
});

test('looksReadable: false for too-short input', () => {
  assert.equal(looksReadable('the and of'), false);
});
