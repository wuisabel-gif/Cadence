# Accuracy benchmark

How well does Cadence's score separate human writing from AI output? This
directory measures it and publishes the numbers, so the claim isn't just "trust
us."

```
npm run bench          # human-readable report + threshold sweep
npm run bench:check     # CI gate: fails if recall or specificity drops
node benchmark/bench.mjs --json     # machine-readable metrics
node benchmark/bench.mjs --sweep     # full precision/recall curve
```

## Results

Corpus: 48 labeled samples (24 human, 24 AI). The human set mixes short modern
writing (texts, reviews, journal entries, a terse commit message) with four
verbatim public-domain passages (Thoreau, Douglass, Twain, Austen) that were
plainly not written to dodge a detector. The AI set spans many registers, from
blatant marketing slop to clean, plain assistant replies. A sample counts as
"flagged" when its score crosses the A/B grade boundary (score > 10). Numbers
carry a Wilson 95% interval, because on 24 samples a point estimate is not the
honest figure.

| metric | value | |
| --- | --- | --- |
| precision | **90.9%** | when it flags AI, it is usually right |
| specificity (human left clean) | **95.8%** (95% CI 80 to 99%) | 23 of 24 |
| recall (AI caught) | **41.7%** (95% CI 25 to 61%) | 10 of 24 |
| F1 | **57.1%** | |
| accuracy | **68.8%** | 33 of 48 |

Precision/recall tradeoff across cutoffs:

| flag when score > | recall | specificity | precision |
| --- | --- | --- | --- |
| 5 | 58.3% | 95.8% | 93.3% |
| 10 (A/B boundary) | 41.7% | 95.8% | 90.9% |
| 15 | 41.7% | 100% | 100% |
| 20 | 20.8% | 100% | 100% |
| 25 (C, the fix-loop cutoff) | 16.7% | 100% | 100% |

The honest read: Cadence is **precision-first**. When it flags text as AI it is
right about nine times in ten, and it rarely accuses a human. Its weakness is
recall. It reliably catches text that leans on the stock tells (banned phrases,
uniform rhythm, reflexive triads), but a lot of modern AI writing avoids those and
scores grade A, so the detector calls most of this AI set "clean." The one false
positive is a real Austen sentence whose four-item list trips the triad rule,
which is a fair example of the tool over-reading a genuine human habit. This is a
weaker headline than an easy corpus would give, and it is the accurate one.

## Honesty caveat

The AI samples and most of the human samples are hand-labeled and authored, so the
author knew what the detector looks for. The public-domain passages reduce that
bias on the human side, but this is still a seed corpus, not a blind third-party
evaluation. Treat the numbers as a regression guard and an honest sanity check, not
a peer-reviewed accuracy claim. Real validation needs a larger held-out corpus of
genuine texts. The corpus is easy to grow: add entries to [corpus.json](corpus.json)
with a `label` of `human` or `ai` and rerun.

## How it works

[bench.mjs](bench.mjs) runs the same `analyze()` the CLI, the browser extension,
and the score page all use, over every sample, then reports the confusion matrix
and derived metrics. No network, no model calls — the detector is deterministic,
so the numbers are reproducible on any machine.
