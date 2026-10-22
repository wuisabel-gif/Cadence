# Accuracy benchmark

How well does Cadence's score separate human writing from AI output? This
directory measures it and publishes the numbers, so the claim isn't just "trust
us."

The scoring arithmetic and the distinction between grades, benchmark cutoffs,
and CLI strict mode are documented in [SCORING.md](../SCORING.md). The benchmark
also reports score distributions and sample-level lexical rule diagnostics so
threshold changes can be reviewed without treating the detector as ground truth.
The proposed separation between regression fixtures and held-out evaluation is
documented in [EVALUATION.md](EVALUATION.md).

```
npm run bench          # human-readable report + threshold sweep
npm run bench:check     # CI gate: fails if recall or specificity drops
node benchmark/bench.mjs --json     # machine-readable metrics
node benchmark/bench.mjs --sweep     # full precision/recall curve
```

## Results

Two sets, scored by the same `analyze()`:

- **Regression corpus** ([corpus.json](corpus.json)): 122 samples, 62 human
  and 60 AI. Rules are tuned against it, and CI guards it.
- **Held-out set** ([heldout.json](heldout.json)): 66 samples, 32 human and
  34 AI. It was split off before any 0.5.0 rule change and scored once, after
  the rules were frozen. It may now be used for development.
- **Next held-out set** ([heldout-0.6.json](heldout-0.6.json)): 70 samples, 35
  human and 35 AI, frozen before any 0.6.0 rule change and not yet scored.

The first 48 corpus samples are the original seed set. Most of those were written
by the project author, who knew the rules. The rest of the corpus and all of the
held-out set came from two sources. Human samples are verbatim public-domain
passages: Project Gutenberg books and US federal pages saved before 2021, each
with its URL. AI samples were written by Claude Opus 5.5 answering realistic
requests in seven registers, with no access to the detector or its rules.
Samples were split per register, alternating, before any scores were looked at.

A sample counts as "flagged" when its score passes the A/B grade boundary
(score > 10). Each rate carries a Wilson 95% interval.

| metric | regression corpus | held-out |
| --- | --- | --- |
| specificity (human left clean) | **98.4%** (61/62, CI 91 to 100%) | **96.9%** (31/32, CI 84 to 99%) |
| recall (AI caught) | **26.7%** (16/60, CI 17 to 39%) | **8.8%** (3/34, CI 3 to 23%) |
| precision | 94.1% | 75.0% |

On the same held-out set, the 0.4.0 detector caught 0 of 34 AI samples at the
same specificity.

Cutoff tradeoff on the regression corpus:

| flag when score > | recall | specificity | precision |
| --- | --- | --- | --- |
| 5 | 33.3% | 88.7% | 74.1% |
| 10 (A/B boundary) | 26.7% | 98.4% | 94.1% |
| 15 | 18.3% | 100% | 100% |
| 25 (C, the fix-loop cutoff) | 10.0% | 100% | 100% |

At a cutoff of 5 the held-out specificity falls to 75%, which is why the boundary
stays at 10.

What this means: Cadence rarely flags a human. It catches AI text that uses the
stock tells, and it misses most AI text that doesn't. Clean modern assistant
prose usually scores grade A. The seed corpus made recall look like 42% because
its AI samples were written to show the tells. A blind sample shows that number
was too high. The one held-out false alarm is a flat national-park description.

## Honesty caveat

Both sets are small, and every new AI sample comes from one model family. The
public-domain human passages skew older and more formal than most writing people
check today. Treat these numbers as a regression guard and a sanity check, not an
accuracy claim. To grow either set, follow [EVALUATION.md](EVALUATION.md): record
provenance and keep held-out samples out of rule tuning.

## How it works

[bench.mjs](bench.mjs) runs the same `analyze()` the CLI, the browser extension,
and the score page all use, over every sample, then reports the confusion matrix
and derived metrics. No network, no model calls — the detector is deterministic,
so the numbers are reproducible on any machine.
