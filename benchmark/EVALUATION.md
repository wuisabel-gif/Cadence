# Benchmark evaluation protocol

Cadence has two different benchmark needs. They should not be conflated.

## Regression corpus

`benchmark/corpus.json` is the small, checked-in regression corpus used by
`npm run bench:check`. It protects detector behavior from accidental changes. Its
labels and text are part of the repository, so changes to it can change the CI
baseline. Keep this corpus small, attributable, and stable.

Each record should include:

- A stable `id`
- A `label` of `human` or `ai`
- A short `note` describing the register or fixture purpose
- `source` or provenance when the text is not original to the repository
- Domain/register metadata when practical

The regression corpus is not a blind evaluation and must not be described as proof
that Cadence identifies authorship.

## Held-out evaluation

`benchmark/heldout-0.6.json` is the current held-out set: 70 samples, 35
human and 35 AI, frozen on 2026-10-21 before any 0.6.0 rule work and not yet
scored. Score it with `node benchmark/bench.mjs --corpus
benchmark/heldout-0.6.json`, once, after rule changes are final. The AI samples
were written by a model that never saw the rules. The human samples are
public-domain passages fetched with curl; whitespace inside a paragraph was
collapsed and HTML entities decoded, and three passages stop partway through
their paragraph.

`benchmark/heldout.json` was the 0.5.0 held-out set. It was scored once for
that release and may now be used for development, so its 66 samples no longer
count as held out.

If a rule is tuned against a held-out set, it stops being held out and belongs
in the regression corpus.

### Known bias: era of the human samples

Most human samples are public-domain text, much of it a century old, while the
AI samples are modern. On the development data, second-person "you" and
contractions separate the labels better than any detector rule. That gap
reflects era, not authorship, and a rule built on it would flag modern human
writing. Recall will not improve honestly until the human side includes modern,
redistributable prose, such as CC BY or CC BY-SA text with attribution.

An evaluation set should be kept outside the training and rule-development
loop. It should not be used to select detector phrases, weights, thresholds, grade
boundaries, or LoRA targets. Report the version, collection date, provenance,
license, domain, language, and generation model or authorship process where known.

At minimum, report:

- Sample counts by label, domain, and register
- Precision, recall, specificity, F1, and accuracy
- Confusion matrix and confidence intervals
- Score distributions by label
- False positives and missed AI samples, with identifiers but without publishing
  restricted text
- The threshold selected before evaluation

If samples are derived from prompts or source documents, split by prompt/source
before evaluation. Otherwise near-duplicates can leak between development and test
sets and make results look stronger than they are.

## Metadata validation

Before adding or evaluating corpus records, check that every record has a stable
identifier, an allowed label, non-empty text, and provenance metadata appropriate to
its license. Record whether text is original, public domain, user-contributed, or
reproduced under a dataset license. Do not redistribute text when the source terms
do not permit it.

A detector score is an observation produced by the system under evaluation. It is
not ground truth. Using Cadence's own score as the sole label, filter, or evaluation
criterion would be circular and could reward the detector for agreeing with itself.

## Recommended sequence

1. Freeze a development set and a separately controlled held-out set.
2. Record provenance and license terms before processing text.
3. Select rules and thresholds using development data only.
4. Run one untouched held-out evaluation and preserve the exact report.
5. Add only deliberately chosen, licensed regression fixtures to the repository.
6. Repeat the protocol when the corpus, detector, or generation domains change.
