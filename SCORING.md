# Cadence scoring model

Cadence reports a deterministic score from 0 to 100. The score is a transparent
heuristic for editing feedback, not a probability that text was written by an AI
and not a scientific measurement of authorship. The current constants are design
choices protected by the benchmark; they are not presented as statistically
proven thresholds.

## Lexical findings

Each finding contributes one severity weight:

| Severity | Points | Current use |
| --- | ---: | --- |
| High | 6 | Banned phrases and negation pivots |
| Medium | 4 | Hollow-confidence words |
| Low | 2 | Triads, hedge stacking, and cliché openers |

A finding is counted each time its detector matches. The score starts at zero and
adds the weights for all findings.

## Structural contributions

Structural rates are normalized per 100 words unless noted otherwise.

| Signal | Activation | Contribution |
| --- | --- | --- |
| Uniform rhythm | At least 5 sentences and sentence-length CV `< 0.4` | `round((0.4 - CV) * 60)` |
| Adverbs | Adverb rate `> 5` | `round((rate - 5) * 2)` |
| Em dashes | Em-dash rate `> 2.5` | `round((rate - 2.5) * 3)` |
| Triad density | Triad findings / sentence count `> 0.25` | `round((density - 0.25) * 40)` |

The sentence-length coefficient of variation is standard deviation divided by
mean sentence length. A low value means sentence lengths cluster closely. The
minimum sentence count prevents a short passage from being judged on rhythm alone.

After all contributions are added, the result is rounded and clamped to the range
0–100. A threshold is only applied when the relevant structural condition is met;
there is no structural contribution on the other side of the threshold.

## Grades

| Score | Grade |
| ---: | :--- |
| 0–10 | A |
| 11–25 | B |
| 26–45 | C |
| 46–70 | D |
| 71–100 | F |

These boundaries are product-facing editing bands, not externally validated
quality standards. In particular, the benchmark's default classification rule is
`score > 10`, which treats text above the A band as flagged for evaluation. The
CLI's `--strict` mode uses a separate default gate of 25. Neither cutoff changes
the score itself.

## Worked example

Suppose a passage has two high-severity findings, one medium finding, and two low
findings. Its lexical subtotal is:

$$
2(6) + 1(4) + 2(2) = 20
$$

If its sentence-length CV is `0.30` across at least five sentences, uniform rhythm
adds `round((0.4 - 0.30) * 60) = 6`, for a score of 26 before any other structural
terms. The grade is C. This example illustrates the arithmetic; it does not claim
that these constants are optimal. A real passage can trigger more than one lexical
detector, so its final score may be higher than the subtotal illustrated here.

## Calibration and interpretation

Cadence is intentionally precision-first: a high score names visible patterns for
an editor to inspect, while a low score does not prove that prose is human. The
checked-in benchmark is a small, labeled regression corpus. It reports uncertainty
and should be treated as a sanity check rather than a validated authorship test.

When changing a weight or threshold, contributors should run the benchmark before
and after the change, inspect human false positives and missed AI samples, and
explain the tradeoff in the pull request. Detector behavior should not change just
because a constant looks more aesthetically pleasing.
