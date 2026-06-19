# /cadence deslop — strip AI tells and report the score

Run the detector on a draft, show the user exactly what reads as AI, and (if they
want) fix it. This is the pure-diagnostic command — no voice required.

## Process

1. **Run the detector.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" draft.txt          # human report
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json draft.txt    # for programmatic use
   ```
   It returns a score (0 clean … 100 heavy slop), a letter grade, the rhythm
   metrics, and every lexical/structural finding grouped by rule.

2. **Explain the findings in plain terms.** Don't just dump the JSON. For each
   group, say what it is and why it reads as AI:
   - `banned-phrase` / `cliche-opener` — templated filler a human editor cuts.
   - `hollow-confidence` — asserting quality instead of showing it.
   - `uniformRhythm: true` — the big one. Every sentence the same length is the
     clearest machine fingerprint.
   - `negation-pivot` — the "it's not X, it's Y" seesaw, overused by models.
   - `triad` density — reflexive three-item lists.

3. **Fix on request.** If the user wants it cleaned (not just diagnosed), edit
   the named tells in place, preserving meaning, then re-run and report the delta.
   Otherwise hand back the report and the two or three highest-leverage fixes.

## What the score is and isn't

- It **is** a reliable, deterministic measure of AI *fingerprints*. Same text,
  same score, every time. A drop from 50 to 10 is real progress you can show.
- It **is not** a measure of whether the writing is good, true, or well-argued.
  A clean score on an empty argument is still an empty argument. Say so if the
  draft is hollow under the surface.

## Tuning

The rule lists live at the top of `scripts/deslop.mjs` (`BANNED_PHRASES`,
`HOLLOW_CONFIDENCE`, `CLICHE_OPENERS`, `HEDGES`). If a user's domain legitimately
uses a flagged word (e.g. "robust" in statistics), note the false positive and,
if it's worth it, propose adding a context guard rather than silently ignoring
the finding. Add a fixture to `tests/deslop.test.mjs` for any rule change.
