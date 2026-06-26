import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';

// Load the generated CommonJS detector the VS Code extension ships.
const require = createRequire(import.meta.url);
const detector = require('../integrations/vscode/detector.js');

const SAMPLES = [
  "In today's world, our seamless and robust platform leverages cutting-edge AI to streamline your workflow.",
  'The river ran low all summer. Then the rains came back, hard and sudden, and the water rose overnight.',
  "It's not just a tool, it's a revolution. When it comes to results, we deliver fast, reliable, and scalable outcomes.",
  'A short one. Then a much longer sentence that winds through several clauses before it finally arrives at its point.',
];

test('the vscode detector exports the core API', () => {
  for (const fn of ['analyze', 'formatReport', 'stripMarkdown', 'stripHtml']) {
    assert.equal(typeof detector[fn], 'function', `missing ${fn}`);
  }
});

test('the vscode detector matches deslop.mjs exactly (run `npm run build:vscode` if this fails)', () => {
  for (const s of SAMPLES) {
    assert.equal(detector.analyze(s).score, analyze(s).score, `score mismatch on: "${s.slice(0, 32)}…"`);
    assert.equal(detector.analyze(s).grade, analyze(s).grade);
  }
});
