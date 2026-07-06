#!/usr/bin/env node
/**
 * LoRA-Cadence eval rig — score model outputs with Cadence's real detector.
 *
 * This is the measurement built before the learned component: it proves the
 * deslop.mjs grading wiring works and produces the honest three-arm table, so a
 * baseline exists before any GPU time. The Kaggle notebook writes each arm's
 * outputs to a JSONL, then shells out to this script.
 *
 * Two modes:
 *
 *   Eval (Phase 3) — compare arms on the same held-out slop:
 *     node lora/eval.mjs base=out_base.jsonl lora=out_lora.jsonl prompt=out_prompt.jsonl
 *     node lora/eval.mjs base=... lora=... --json
 *   Each file is JSONL of {"id": "...", "text": "<the arm's humanized output>"}.
 *   The arm named "base" (or the first arm) is the baseline for deltas.
 *
 *   Filter (Phase 1, the key step) — keep only verified grade-A training pairs:
 *     node lora/eval.mjs --filter pairs.jsonl --max 15 --out kept.jsonl
 *   pairs.jsonl is JSONL of {"instruction","input","output"}; keeps lines whose
 *   `output` scores at or below --max (default 15), drops the rest, reports both.
 *
 * The detector is deterministic and dependency-free, so results reproduce on any
 * machine — including a Kaggle notebook with this repo added as a dataset.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { analyze } from '../skills/cadence/scripts/deslop.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(name);

function readJsonl(path) {
  return readFileSync(path, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch (e) { throw new Error(`${path} line ${i + 1}: not JSON`); }
  });
}

const GRADES = ['A', 'B', 'C', 'D', 'F'];
const pct = (x) => (x * 100).toFixed(0);

// ── Phase 1: dataset filter ──────────────────────────────────────────────────
if (has('--filter')) {
  const path = flag('--filter');
  const max = Number(flag('--max') ?? 15);
  const out = flag('--out');
  const rows = readJsonl(path);
  const kept = [], dropped = [];
  for (const r of rows) {
    const text = r.output ?? r.text ?? '';
    const score = analyze(text).score;
    (score <= max ? kept : dropped).push({ ...r, _score: score });
  }
  if (out) writeFileSync(out, kept.map((r) => { const { _score, ...rest } = r; return JSON.stringify(rest); }).join('\n') + '\n');
  process.stderr.write(
    `Filter: kept ${kept.length}/${rows.length} pairs (output score <= ${max}); dropped ${dropped.length}.\n` +
    (out ? `Wrote kept pairs to ${out}.\n` : 'Pass --out <file> to save the kept pairs.\n')
  );
  process.exit(0);
}

// ── Phase 3: three-arm eval ──────────────────────────────────────────────────
const arms = args.filter((a) => a.includes('=')).map((a) => {
  const idx = a.indexOf('=');
  return { name: a.slice(0, idx), path: a.slice(idx + 1) };
});
if (!arms.length) {
  process.stderr.write('Usage: node lora/eval.mjs base=out_base.jsonl lora=out_lora.jsonl [prompt=out_prompt.jsonl] [--json]\n');
  process.exit(1);
}

function scoreArm(arm) {
  const rows = readJsonl(arm.path);
  const grades = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const tells = {};
  let sumScore = 0, sumCV = 0;
  for (const r of rows) {
    const res = analyze(r.text ?? r.output ?? '');
    sumScore += res.score;
    sumCV += res.metrics.sentenceLengthCV;
    grades[res.grade]++;
    for (const f of res.findings) tells[f.rule] = (tells[f.rule] || 0) + 1;
  }
  const n = rows.length || 1;
  return {
    name: arm.name, n: rows.length,
    meanScore: +(sumScore / n).toFixed(1),
    meanCV: +(sumCV / n).toFixed(3),
    grades, tells,
  };
}

const results = arms.map(scoreArm);
const baseline = results.find((r) => r.name === 'base') || results[0];

if (has('--json')) {
  process.stdout.write(JSON.stringify({ baseline: baseline.name, arms: results }, null, 2) + '\n');
} else {
  const L = [];
  L.push(`LoRA-Cadence eval  ·  scored by deslop.mjs (the real detector)`);
  L.push('─'.repeat(72));
  L.push('arm'.padEnd(9) + 'N'.padStart(4) + 'mean'.padStart(8) + '  rhythm CV   grades (A/B/C/D/F)');
  for (const r of results) {
    const g = GRADES.map((k) => r.grades[k]).join('/');
    L.push(r.name.padEnd(9) + String(r.n).padStart(4) + String(r.meanScore).padStart(8) + '  ' + String(r.meanCV).padEnd(10) + '  ' + g);
  }
  L.push('─'.repeat(72));
  // Deltas vs baseline — always show CV alongside score (the honest gate).
  L.push(`deltas vs ${baseline.name} (negative score = less slop; positive CV = more rhythm variance):`);
  for (const r of results) {
    if (r.name === baseline.name) continue;
    const ds = (r.meanScore - baseline.meanScore).toFixed(1);
    const dcv = (r.meanCV - baseline.meanCV >= 0 ? '+' : '') + (r.meanCV - baseline.meanCV).toFixed(3);
    L.push(`  ${r.name.padEnd(8)} score ${ds >= 0 ? '+' + ds : ds}   CV ${dcv}`);
  }
  L.push('─'.repeat(72));
  // Per-tell breakdown — which categories each arm still trips.
  L.push('tells remaining per arm (lower is better):');
  const allRules = [...new Set(results.flatMap((r) => Object.keys(r.tells)))].sort();
  for (const r of results) {
    const parts = allRules.map((k) => `${k} ${r.tells[k] || 0}`);
    L.push(`  ${r.name.padEnd(8)} ${parts.join(', ') || 'none'}`);
  }
  process.stdout.write(L.join('\n') + '\n');
}
