import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analyze, splitSentences, words, stripMarkdown, stripHtml, scanDir, applyFixes, addedProseByFile, analyzeParagraphs } from '../skills/cadence/scripts/deslop.mjs';

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

test('applyFixes swaps hollow words, deletes throat-clears, keeps grammar', () => {
  const src = "In today's world, we leverage robust tools. It's worth noting that this is comprehensive.";
  const r = analyze(src);
  const { text, applied } = applyFixes(src, r.findings);
  assert.ok(applied >= 3, `expected >=3 fixes, got ${applied}: ${text}`);
  assert.ok(!/\bleverage\b|\brobust\b|\bcomprehensive\b/i.test(text), `swaps left over: ${text}`);
  assert.ok(!/in today's world/i.test(text), `throat-clear left: ${text}`);
  assert.ok(/^[A-Z]/.test(text.trim()), `should stay capitalized: ${text}`);
  assert.ok(!/\s[,.]/.test(text), `space-before-punctuation left: ${text}`);
  assert.ok(analyze(text).score < r.score, 'score should drop after fixing');
});

test('applyFixes preserves curly quotes it did not touch and is offset-safe', () => {
  const src = 'We leverage “smart” tools that are robust — really robust.';
  const { text } = applyFixes(src, analyze(src).findings);
  assert.ok(text.includes('“smart”'), `curly quotes lost: ${text}`);
  assert.ok(!/\brobust\b/i.test(text), `robust left: ${text}`);
  assert.match(text, /^We use /);
});

test('addedProseByFile keeps added prose lines, skips code files and removals', () => {
  const diff = [
    'diff --git a/post.md b/post.md',
    '--- a/post.md',
    '+++ b/post.md',
    '@@ -1 +1,2 @@',
    '-an old sentence that should be ignored',
    "+In today's world, we leverage synergy to move fast.",
    '+A second added line of prose here.',
    'diff --git a/app.js b/app.js',
    '--- a/app.js',
    '+++ b/app.js',
    '@@ -0,0 +1 @@',
    '+const notProse = 1;',
  ].join('\n');
  const map = addedProseByFile(diff);
  assert.ok(map.has('post.md'), 'prose file present');
  assert.ok(!map.has('app.js'), 'code file skipped');
  assert.match(map.get('post.md'), /leverage synergy/);
  assert.ok(!/old sentence/.test(map.get('post.md')), 'removed lines excluded');
});

test('analyzeParagraphs scores each block and isolates the slop paragraph', () => {
  const clean = 'The river ran low all summer. Then the rains came back, hard and sudden, and the water rose overnight past the old marker.';
  const slop = "In today's world, our seamless and robust platform leverages cutting-edge synergy to unlock transformative, scalable outcomes.";
  const rows = analyzeParagraphs(`${clean}\n\n${slop}`);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].index, 0);
  const bySlop = rows.find((p) => p.score === Math.max(...rows.map((x) => x.score)));
  assert.ok(bySlop.snippet.startsWith('In today'), `worst block should be the slop: ${bySlop.snippet}`);
  assert.ok(bySlop.score > rows.find((p) => p.index === 0).score, 'slop block scores worse than clean block');
  assert.ok(bySlop.findings.length > 0);
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

test('stripMarkdown drops code, quotes, tables, headings, and HTML', () => {
  const md = [
    '# Heading',
    '',
    'Real prose stays here and reads fine.',
    '',
    '```',
    "In today's world our seamless robust platform.",
    '```',
    '',
    '> a quoted blockquote line',
    '| a | table | row |',
    '<p align="center">html scaffolding</p>',
  ].join('\n');
  const out = stripMarkdown(md);
  assert.match(out, /Real prose stays here/);
  assert.doesNotMatch(out, /Heading/);
  assert.doesNotMatch(out, /seamless robust/); // fenced demo excluded
  assert.doesNotMatch(out, /blockquote/);
  assert.doesNotMatch(out, /table/);
  assert.doesNotMatch(out, /scaffolding/);
});

test('prose-only: quoted slop in a fenced block does not inflate the score', () => {
  const md = 'A clean human sentence that varies in length. Then a short one.\n\n'
    + "```\nIn today's world our seamless robust platform leverages cutting-edge AI.\n```\n";
  assert.ok(analyze(md).score > analyze(stripMarkdown(md)).score);
});

test('stripHtml extracts visible text and drops scripts, styles, and tags', () => {
  const html = '<html><head><style>body{color:red}</style></head><body>'
    + '<h1>The Title</h1><p>Hello &amp; welcome to the page.</p>'
    + '<script>var secret = 1;</script></body></html>';
  const out = stripHtml(html);
  assert.match(out, /The Title/);
  assert.match(out, /Hello & welcome to the page\./); // entity decoded
  assert.doesNotMatch(out, /color:red/);  // <style> body gone
  assert.doesNotMatch(out, /secret/);     // <script> body gone
  assert.doesNotMatch(out, /</);          // no tags survive
});

test('stripHtml breaks block elements onto separate lines', () => {
  // Without line breaks these would merge into one run-on "sentence".
  const out = stripHtml('<p>First idea here.</p><p>Second idea here.</p>');
  assert.equal(splitSentences(out).length, 2);
});

test('scanDir walks a repo, ranks worst-first, and skips node_modules', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-scan-'));
  writeFileSync(join(dir, 'clean.md'),
    'The river ran low all summer. Then the rains came back hard, and the water rose overnight.');
  writeFileSync(join(dir, 'sloppy.md'),
    "In today's world, our seamless and robust platform leverages cutting-edge AI to streamline everything for you.");
  mkdirSync(join(dir, 'node_modules'));
  writeFileSync(join(dir, 'node_modules', 'junk.md'),
    "In today's world, seamless robust cutting-edge synergy that we leverage.");
  const rows = scanDir(dir);
  assert.equal(rows.length, 2);              // node_modules skipped
  assert.equal(rows[0].file, 'sloppy.md');   // worst first
  assert.ok(rows[0].score > rows[1].score);
});
