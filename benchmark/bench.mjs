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
 * the A/B grade boundary, i.e. "shows at least a grade-B's worth of tells"). Almost
 * every human sample lands at or below that line, so it is where the two
 * populations separate best. Tune with --threshold N; --sweep shows the curve.
 *
 * This is a seed corpus of representative samples, not a blind third-party
 * evaluation — see benchmark/README.md for the honesty caveat.
 */
import { readFileSync } from 'node:fs';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';

const args = process.argv.slice(2);
const ti = args.indexOf('--threshold');
const THRESHOLD = ti >= 0 ? Number(args[ti + 1]) : 10;
// Regression guards, set below the current numbers, not aspirational targets.
// The detector is precision-first: recall is its known weak spot (it misses AI
// that avoids the common tells), so the recall floor only catches a big drop.
const FLOOR_RECALL = 0.30;
const FLOOR_SPEC = 0.85;

const corpus = JSON.parse(readFileSync(new URL('./corpus.json', import.meta.url), 'utf8'));
const scored = corpus.map((s) => ({ ...s, r: analyze(s.text) }));
const pct = (x) => (x * 100).toFixed(1);

// Wilson 95% score interval for a proportion k/n. On a small corpus the point
// estimate is not the honest number — this is the range the rate could really be.
function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, z2 = z * z;
  const c = (p + z2 / (2 * n)) / (1 + z2 / n);
  const h = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const ci = (k, n) => { const [lo, hi] = wilson(k, n); return `95% CI ${pct(lo)}-${pct(hi)}%`; };

// Diagnostics are sample-level: a rule that fires three times in one sample
// still counts as one sample containing that rule. This keeps per-rule rates
// comparable across rules with different numbers of findings.
const corpusHuman = corpus.filter((s) => s.label === 'human').length;
const corpusAI = corpus.filter((s) => s.label === 'ai').length;
const RULES = [...new Set(scored.flatMap((s) => s.r.findings.map((f) => f.rule)))].sort();
const scoreSummary = (label) => {
  const values = scored.filter((s) => !label || s.label === label).map((s) => s.r.score).sort((a, b) => a - b);
  if (!values.length) return { samples: 0, min: 0, max: 0, mean: 0, median: 0 };
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
  return { samples: values.length, min: values[0], max: values.at(-1), mean: +(values.reduce((sum, x) => sum + x, 0) / values.length).toFixed(1), median };
};
const scoreDistributions = Object.fromEntries(['human', 'ai'].map((label) => [label, scoreSummary(label)]));
const ruleDiagnostics = RULES.map((rule) => {
  const samples = scored.filter((s) => s.r.findings.some((f) => f.rule === rule));
  const human = samples.filter((s) => s.label === 'human').length;
  const ai = samples.filter((s) => s.label === 'ai').length;
  return { rule, samples: samples.length, human, ai,
    humanRate: +(human / (corpusHuman || 1)).toFixed(3), aiRate: +(ai / (corpusAI || 1)).toFixed(3) };
});

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
  recall: +recall.toFixed(3), recallCI: wilson(tp, nAI).map((x) => +x.toFixed(3)),
  specificity: +specificity.toFixed(3), specificityCI: wilson(tn, nHuman).map((x) => +x.toFixed(3)),
  fpr: +fpr.toFixed(3), precision: +precision.toFixed(3), f1: +f1.toFixed(3),
  accuracy: +accuracy.toFixed(3), confusion: { tp, fp, tn, fn }, scoreDistributions, ruleDiagnostics,
};

if (args.includes('--json')) {
  process.stdout.write(JSON.stringify({ metrics, rows }, null, 2) + '\n');
} else {
  const L = [];
  L.push(`Cadence accuracy benchmark  ·  ${corpus.length} samples  ·  flag when score > ${THRESHOLD}`);
  L.push('─'.repeat(58));
  L.push(`recall (AI caught)        ${pct(recall)}%   ${tp}/${nAI}   ${ci(tp, nAI)}`);
  L.push(`specificity (human clean) ${pct(specificity)}%   ${tn}/${nHuman}   ${ci(tn, nHuman)}`);
  L.push(`false-positive rate       ${pct(fpr)}%`);
  L.push(`precision                 ${pct(precision)}%`);
  L.push(`F1                        ${pct(f1)}%`);
  L.push(`accuracy                  ${pct(accuracy)}%`);
  L.push('score distribution:');
  for (const label of ['human', 'ai']) {
    const d = scoreDistributions[label];
    L.push(`  ${label.padEnd(6)} min ${String(d.min).padStart(3)}  median ${String(d.median).padStart(4)}  mean ${d.mean.toFixed(1).padStart(5)}  max ${String(d.max).padStart(3)}`);
  }
  L.push('rule diagnostics (human rate / AI rate):');
  for (const d of ruleDiagnostics) {
    L.push(`  ${d.rule.padEnd(20)} ${(d.humanRate * 100).toFixed(1)}% / ${(d.aiRate * 100).toFixed(1)}%`);
  }
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
