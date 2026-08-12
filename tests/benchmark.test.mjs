import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const corpus = JSON.parse(readFileSync(new URL('../benchmark/corpus.json', import.meta.url), 'utf8'));
const expectedHuman = corpus.filter((sample) => sample.label === 'human').length;
const expectedAI = corpus.filter((sample) => sample.label === 'ai').length;

test('benchmark JSON exposes stable calibration diagnostics', () => {
  const output = execFileSync(process.execPath, ['benchmark/bench.mjs', '--json'], { encoding: 'utf8' });
  const { metrics } = JSON.parse(output);

  assert.equal(metrics.samples, corpus.length);
  assert.equal(metrics.human, expectedHuman);
  assert.equal(metrics.ai, expectedAI);
  assert.equal(metrics.confusion.tp + metrics.confusion.fp + metrics.confusion.tn + metrics.confusion.fn, metrics.samples);
  assert.equal(metrics.scoreDistributions.human.samples, metrics.human);
  assert.equal(metrics.scoreDistributions.ai.samples, metrics.ai);

  for (const diagnostic of metrics.ruleDiagnostics) {
    assert.ok(diagnostic.rule || diagnostic.signal);
    assert.ok(diagnostic.human >= 0 && diagnostic.ai >= 0);
    assert.ok(diagnostic.humanRate >= 0 && diagnostic.humanRate <= 1);
    assert.ok(diagnostic.aiRate >= 0 && diagnostic.aiRate <= 1);
  }
});
