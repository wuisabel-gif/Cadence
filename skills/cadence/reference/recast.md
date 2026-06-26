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

2. **Load the target voice** (`voices/<name>.md`). If the user didn't name one,
   run the **voice picker** from SKILL.md (list all ten seeds and let them
   choose) before rewriting. Read the profile, ending on the Calibration line.

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

## Recasting a whole file in place (HTML, Markdown, text)

When the user points at a file — "de-slop `index.html`", "recast this page" — rewrite
the **prose only** and leave everything else byte-for-byte.

1. **Score it first.** `deslop.mjs <file>` auto-detects `.html` (visible text) and
   takes `--prose-only` for Markdown. Save the before-score.
2. **Edit the words, never the structure.** Recast each block of visible copy in
   place with the `Edit` tool:
   - **HTML** — rewrite the text inside content elements (`<p>`, `<li>`, headings,
     `<blockquote>`, link text). Never touch tags, attributes, classes, `<script>`,
     `<style>`, or layout. The DOM shape stays identical; only the words change.
   - **Markdown** — rewrite paragraphs; leave code fences, tables, frontmatter, and
     link targets intact.
   - Skip text that is *meant* to be slop (a quoted bad example, a demo). Ask if
     unsure.
3. **Re-score and report the delta** the same way (`deslop.mjs <file>` again), with
   a couple of before/after sentence pairs. Confirm the markup is unchanged.

This is the same recasting discipline as above, applied element by element. The user
keeps their layout; the writing gets better.

## Pitfalls

- **Over-recasting** drifts from the user's meaning to hit a voice. The meaning
  wins. A faithful B beats a stylish distortion.
- **Breaking markup.** On a file recast, changing a tag, attribute, or class is a
  bug. If a rewrite would need a structural change, leave it and flag it instead.
- **Recasting already-good prose** can flatten it. If the original scores under
  ~15 and the user only wanted a voice shift, change diction and rhythm lightly;
  don't rebuild what isn't broken.
- **Length creep.** Recasts tend to grow. Aim to match the original's length or
  come in under it.
