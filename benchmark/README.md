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
- **Held-out set** ([heldout-0.6.json](heldout-0.6.json)): 70 samples, 35
  human and 35 AI. It was frozen before any 0.7.0 rule work and scored once,
  after the vocabulary-variety rule was final. The exact reports are in
  [reports/](reports/). It may now be used for development.
- **Modern human set** ([modern-human.json](modern-human.json)): 80 human
  passages written before November 30, 2022 (Stack Exchange, Wikinews,
  Wikipedia, Wikibooks), under CC BY-SA or CC BY with source links. It checks
  that a rule does not just flag modern writing. It is development data.
- **0.5.0 held-out set** ([heldout.json](heldout.json)): 66 samples, scored
  once for 0.5.0 and used for development since.

The first 48 corpus samples are the original seed set. Most of those were written
by the project author, who knew the rules. The rest of the corpus and all of the
held-out set came from two sources. Human samples are verbatim public-domain
passages: Project Gutenberg books and US federal pages saved before 2021, each
with its URL. AI samples were written by Claude Opus 5.5 answering realistic
requests in seven registers, with no access to the detector or its rules.
Samples were split per register, alternating, before any scores were looked at.

A sample counts as "flagged" when its score passes the A/B grade boundary
(score > 10). Each rate carries a Wilson 95% interval.

| metric | regression corpus | held-out (0.6) | modern human |
| --- | --- | --- | --- |
| specificity (human left clean) | **98.4%** (61/62, CI 91 to 100%) | **85.7%** (30/35, CI 71 to 94%) | **95.0%** (76/80, CI 88 to 98%) |
| recall (AI caught) | **31.7%** (19/60, CI 21 to 45%) | **14.3%** (5/35, CI 6 to 29%) | n/a |
| precision | 95.0% | 50.0% | n/a |

On the same held-out set, the released 0.6.0 detector caught 2 of 35 AI samples
with the same 5 false alarms. The new rule added recall without new false alarms
there, and without new false alarms on the modern human set.

Cutoff tradeoff on the regression corpus:

| flag when score > | recall | specificity | precision |
| --- | --- | --- | --- |
| 5 | 40.0% | 88.7% | 77.4% |
| 10 (A/B boundary) | 31.7% | 98.4% | 95.0% |
| 15 | 23.3% | 100% | 100% |
| 25 (C, the fix-loop cutoff) | 10.0% | 100% | 100% |

What this means: Cadence rarely flags a human in the regression corpus, but fresh
text is harder. On the 0.6 held-out set it flagged 5 of 35 human passages. Two
were flagged for uniform rhythm (a recipe and a press release) and two for
triads in health advice. One triad match ("chronic, severe, or even") treats
"even" as a list item, which looks like a bug. Those fixes wait for the next
round, so this set's result stays an honest test. Recall is still low: most AI
text that avoids the stock tells scores grade A.

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
