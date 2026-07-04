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

Corpus: 24 labeled samples (12 human, 12 AI), each a short real-world passage —
emails, messages, posts, product copy. A sample counts as "flagged" when its
score crosses the A/B grade boundary (score > 10), the point where the two
populations separate: every human sample scores at or below 5.

| metric | value | |
| --- | --- | --- |
| recall (AI caught) | **75.0%** | 9 of 12 |
| specificity (human left clean) | **100.0%** | 12 of 12 |
| precision | **100.0%** | no false alarms |
| false-positive rate | **0.0%** | |
| F1 | **85.7%** | |
| accuracy | **87.5%** | 21 of 24 |

Precision/recall tradeoff across grade cutoffs:

| flag when score > | recall | specificity | precision |
| --- | --- | --- | --- |
| 5 | 83.3% | 100% | 100% |
| 10 (A/B boundary) | 75.0% | 100% | 100% |
| 15 | 75.0% | 100% | 100% |
| 20 | 41.7% | 100% | 100% |
| 25 (C, the fix-loop cutoff) | 33.3% | 100% | 100% |

Two things this shows. First, Cadence is tuned for precision: it never
mislabels a human sample, at any threshold. Second, the letter grades are
calibrated for editing your own writing ("does this need a cleanup pass?"), not
for a binary human-or-machine verdict — for detection, the A/B boundary is the
right cut. The three misses are the deliberately hard cases: a warm one-line
sympathy message, a clean short reply, and a bland meeting recap. Short,
plainly-written AI text with no lexical tells is genuinely hard to separate from
a terse human, and a detector that flagged it would also start flagging real
people. We would rather miss those than accuse a person.

## Honesty caveat

This is a seed corpus of representative samples, hand-labeled, not a blind
third-party evaluation. The samples were written to span common human and AI
registers, but the author knew what the detector looks for, so treat these
numbers as a regression floor and a sanity check, not a peer-reviewed accuracy
claim. Real validation needs a larger held-out corpus of genuine texts. The
corpus is easy to grow: add entries to [corpus.json](corpus.json) with a
`label` of `human` or `ai` and rerun.

## How it works

[bench.mjs](bench.mjs) runs the same `analyze()` the CLI, the browser extension,
and the score page all use, over every sample, then reports the confusion matrix
and derived metrics. No network, no model calls — the detector is deterministic,
so the numbers are reproducible on any machine.
