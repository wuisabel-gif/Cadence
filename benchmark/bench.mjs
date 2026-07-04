#!/usr/bin/env node
/**
 * Accuracy benchmark for the Cadence detector.
 *
 * Runs analyze() over a labeled corpus (benchmark/corpus.json) and reports how
 * well the score separates human writing from AI output: recall (AI caught),
 * false-positive rate (human wrongly flagged), precision, F1, accuracy.
 *
 *   node benchmark/bench.mjs           human-readable report
 *   node benchmark/bench.mjs --json    machine-readable metrics
 *   node benchmark/bench.mjs --check   exit 1 if below the floors (CI gate)
 *
 * A sample is "flagged as AI" when its score exceeds the threshold (default 10 —
 * the A/B grade boundary, i.e. "shows at least a grade-B's worth of tells").
 * Human prose in the corpus all scores at or below 5, so this boundary is where
 * the two populations separate. Tune with --threshold N; --sweep shows the curve.
 *
 * This is a seed corpus of representative samples, not a blind third-party
 * evaluation — see benchmark/README.md for the honesty caveat.
 */
import { readFileSync } from 'node:fs';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';

const args = process.argv.slice(2);
const ti = args.indexOf('--threshold');
const THRESHOLD = ti >= 0 ? Number(args[ti + 1]) : 10;
const FLOOR_RECALL = 0.70;   // catch at least 70% of AI samples
const FLOOR_SPEC = 0.90;     // wrongly flag at most 10% of human samples

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));
const scored = corpus.map((s) => ({ ...s, r: analyze(s.text) }));
const pct = (x) => (x * 100).toFixed(1);

// Confusion counts + derived metrics for a given "flag when score > threshold" cut.
function scoreAt(threshold) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  const rows = [];
  for (const s of scored) {
    const flagged = s.r.score > threshold;
    const isAI = s.label === 'ai';
    if (isAI && flagged) tp++;
    else if (isAI && !flagged) fn++;
    else if (!isAI && flagged) fp++;
    else tn++;
    rows.push({ id: s.id, label: s.label, note: s.note, score: s.r.score, grade: s.r.grade, flagged, correct: isAI === flagged });
  }
  const nAI = tp + fn, nHuman = tn + fp;
  const recall = nAI ? tp / nAI : 0;
  const specificity = nHuman ? tn / nHuman : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { threshold, tp, fp, tn, fn, nAI, nHuman, recall, specificity, fpr: 1 - specificity,
    precision, f1, accuracy: corpus.length ? (tp + tn) / corpus.length : 0, rows };
}

const M = scoreAt(THRESHOLD);
const { tp, fp, tn, fn, nAI, nHuman, recall, specificity, fpr, precision, f1, accuracy, rows } = M;

const metrics = {
  threshold: THRESHOLD, samples: corpus.length, human: nHuman, ai: nAI,
  recall: +recall.toFixed(3), specificity: +specificity.toFixed(3), fpr: +fpr.toFixed(3),
  precision: +precision.toFixed(3), f1: +f1.toFixed(3), accuracy: +accuracy.toFixed(3),
  confusion: { tp, fp, tn, fn },
};

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify({ metrics, rows }, null, 2) + '\n');
} else {
  const L = [];
  L.push(`Cadence accuracy benchmark  ·  ${corpus.length} samples  ·  flag when score > ${THRESHOLD}`);
  L.push('─'.repeat(58));
  L.push(`recall (AI caught)        ${pct(recall)}%   ${tp}/${nAI}`);
  L.push(`specificity (human clean) ${pct(specificity)}%   ${tn}/${nHuman}`);
  L.push(`false-positive rate       ${pct(fpr)}%`);
  L.push(`precision                 ${pct(precision)}%`);
  L.push(`F1                        ${pct(f1)}%`);
  L.push(`accuracy                  ${pct(accuracy)}%`);
  L.push('─'.repeat(58));
  const misses = rows.filter((r) => !r.correct);
  if (misses.length) {
    L.push(`${misses.length} misclassified:`);
    for (const m of misses) {
      const kind = m.label === 'ai' ? 'AI scored too low (missed)' : 'human scored too high (false alarm)';
      L.push(`  ${m.id}  ${m.label}  score ${m.score} (${m.grade})  — ${kind}  · ${m.note}`);
    }
  } else {
    L.push('every sample classified correctly.');
  }
  L.push('─'.repeat(58));
  L.push('threshold sweep (precision/recall tradeoff):');
  L.push('  score >   recall   specificity   precision   F1');
  for (const t of [5, 10, 15, 20, 25]) {
    const m = scoreAt(t);
    const mark = t === THRESHOLD ? ' ←' : '';
    L.push(`  ${String(t).padStart(6)}   ${pct(m.recall).padStart(5)}%       ${pct(m.specificity).padStart(5)}%      ${pct(m.precision).padStart(5)}%   ${pct(m.f1).padStart(5)}%${mark}`);
  }
  process.stdout.write(L.join('\n') + '\n');
}

if (args.includes('--check')) {
  const ok = recall >= FLOOR_RECALL && specificity >= FLOOR_SPEC;
  if (!ok) {
    process.stderr.write(`\nFAIL: recall ${pct(recall)}% (floor ${pct(FLOOR_RECALL)}%), specificity ${pct(specificity)}% (floor ${pct(FLOOR_SPEC)}%)\n`);
    process.exit(1);
  }
  process.stderr.write(`\nPASS: recall and specificity both at or above floor.\n`);
}
