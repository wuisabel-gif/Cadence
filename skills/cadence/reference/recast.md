# /cadence recast — rewrite existing text into a chosen voice

Take text the user already has — an AI draft, their rough notes, a stiff
paragraph — and rewrite it in a chosen voice without losing the meaning.

## Process

1. **Measure the original first.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json original.txt
   ```
   This is your before-number and your map: the findings list tells you exactly
   which tells to remove. Save the score to report the delta later.

2. **Load the target voice** (`voices/<name>.md`). Read it, ending on the
   Calibration line.

3. **Preserve the argument, replace the surface.** Recast is not paraphrase and
   not summary. Keep every claim, fact, and piece of structure the user put
   there. Change how it sounds, not what it says. If you find yourself dropping a
   point to make a sentence flow, stop — restructure instead.

4. **Work the findings.** Go down the original's detector findings and fix each:
   - hollow-confidence word → show the thing or cut the claim
   - negation-pivot → state it straight
   - triad → keep the strongest item, or make it a real list with real items
   - uniform rhythm → split and merge sentences until the length swings
   - cliche opener → start on the first real idea

5. **Re-measure and compare.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json recast.txt
   ```
   You want a clear drop and a CV inside the voice's range. If the score barely
   moved, you paraphrased instead of recasting — go again.

6. **Hand back** the rewrite plus the delta: `slop score 52 → 9 · rhythm CV 0.31
   → 0.55 · voice: plain`. Optionally show one or two before/after sentence pairs
   so the user can see the move.

## Pitfalls

- **Over-recasting** drifts from the user's meaning to hit a voice. The meaning
  wins. A faithful B beats a stylish distortion.
- **Recasting already-good prose** can flatten it. If the original scores under
  ~15 and the user only wanted a voice shift, change diction and rhythm lightly;
  don't rebuild what isn't broken.
- **Length creep.** Recasts tend to grow. Aim to match the original's length or
  come in under it.
