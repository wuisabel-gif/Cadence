import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, splitSentences, words } from '../skills/cadence/scripts/deslop.mjs';

// Representative slop: banned phrases, hollow confidence, uniform rhythm,
// a negation pivot, a triad, and a cliché opener — all the tells at once.
const SLOP = `In today's world, our platform delivers a seamless and robust experience.
We leverage cutting-edge technology to empower your team and streamline your workflow.
It's not just a tool, it's a revolution in how you work.
Our comprehensive solution is powerful, innovative, and transformative.
When it comes to results, we deliver fast, reliable, and scalable outcomes.
At the end of the day, we help you unlock the power of your data.`;

// Representative human prose: real swing between long and short sentences,
// concrete images, no AI tells. Original text written for this fixture.
const HUMAN = `The river had been low all summer, and the stones that usually sat under a foot of water now baked white in the sun.
Nobody fished there anymore.
Boys still came down at dusk, picking their way across the dry bed toward the one deep pool that remained, where the trout had crowded in against their will.
You could see them from the bank if you stood still.
A dark shifting mass.
The first boy to wade out always swore he would only look, and the others always knew he was lying.`;

test('clean human prose scores low', () => {
  const r = analyze(HUMAN);
  assert.ok(r.score < 25, `expected human prose to score < 25, got ${r.score}`);
  assert.ok(['A', 'B'].includes(r.grade), `expected grade A/B, got ${r.grade}`);
});

test('slop scores high', () => {
  const r = analyze(SLOP);
  assert.ok(r.score > 45, `expected slop to score > 45, got ${r.score}`);
});

test('slop scores strictly worse than human', () => {
  assert.ok(analyze(SLOP).score > analyze(HUMAN).score);
});

test('catches banned phrases', () => {
  const r = analyze(SLOP);
  const banned = r.findings.filter((f) => f.rule === 'banned-phrase');
  assert.ok(banned.length >= 3, `expected >=3 banned phrases, got ${banned.length}`);
});

test('catches hollow-confidence words', () => {
  const r = analyze(SLOP);
  const hollow = r.findings.filter((f) => f.rule === 'hollow-confidence').map((f) => f.snippet.toLowerCase());
  assert.ok(hollow.includes('seamless'));
  assert.ok(hollow.includes('robust'));
});

test('catches the negation pivot', () => {
  const r = analyze(SLOP);
  assert.ok(r.findings.some((f) => f.rule === 'negation-pivot'));
});

test('flags uniform rhythm and rewards variance', () => {
  // Six sentences, all ~7 words → uniform.
  const flat = 'The cat sat on the warm mat. The dog ran across the green yard. ' +
    'A bird flew over the tall tree. The fish swam in the cold lake. ' +
    'The kid played with the red ball. The man walked along the long road.';
  assert.equal(analyze(flat).metrics.uniformRhythm, true);
  assert.equal(analyze(HUMAN).metrics.uniformRhythm, false);
});

test('sentence splitter respects abbreviations', () => {
  const s = splitSentences('Dr. Smith arrived at 5 p.m. He was late.');
  assert.equal(s.length, 2, `expected 2 sentences, got ${s.length}: ${JSON.stringify(s)}`);
});

test('triad detection fires on three-item lists', () => {
  const r = analyze('We deliver fast, reliable, and scalable outcomes for everyone.');
  assert.ok(r.findings.some((f) => f.rule === 'triad'));
});

test('does not false-positive "co" inside words', () => {
  const r = analyze('The coffee company connected its core services together nicely.');
  assert.ok(!r.findings.some((f) => f.snippet === 'co'));
});

test('empty input is safe', () => {
  const r = analyze('');
  assert.equal(r.score, 0);
  assert.equal(r.metrics.sentences, 0);
});

test('words() and splitSentences() are exported and pure', () => {
  assert.deepEqual(words('Hello, World!'), ['hello', 'world']);
  assert.equal(splitSentences('One. Two. Three.').length, 3);
});
