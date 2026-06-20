import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';

// Load the generated browser detector into a fake `window` and grab cadenceAnalyze.
const code = readFileSync(new URL('../extension/detector.js', import.meta.url), 'utf8');
const win = {};
// eslint-disable-next-line no-new-func
new Function('window', code)(win);

const SAMPLES = [
  "In today's world, our seamless and robust platform leverages cutting-edge AI to streamline your workflow.",
  'The river ran low all summer. Then the rains came back, hard and sudden, and the water rose overnight.',
  "It's not just a tool, it's a revolution. When it comes to results, we deliver fast, reliable, and scalable outcomes.",
  'A short one. Then a much longer sentence that winds through several clauses before it finally arrives at its point.',
];

test('the extension exposes cadenceAnalyze', () => {
  assert.equal(typeof win.cadenceAnalyze, 'function');
});

test('the browser detector matches deslop.mjs exactly (run `npm run build:extension` if this fails)', () => {
  for (const s of SAMPLES) {
    assert.equal(win.cadenceAnalyze(s).score, analyze(s).score, `score mismatch on: "${s.slice(0, 32)}…"`);
    assert.equal(win.cadenceAnalyze(s).grade, analyze(s).grade);
  }
});
