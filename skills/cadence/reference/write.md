# /cadence write — draft new prose in a chosen voice

Draft something new (post, essay, email, landing section, thread) that sounds
human and matches a chosen voice.

## Process

1. **Load the voice.** Read `voices/<name>.md`. If the user didn't name one, pick
   from the Setup rules in SKILL.md (default `plain` for utilitarian copy). Read
   the whole profile, then re-read the **Calibration line** last — it sets your
   ear right before you write.

2. **Get the substance straight first.** Know what you're actually saying — the
   claim, the example, the takeaway — before you style it. Voice is how it's
   said, not a substitute for having something to say.

3. **Draft against the profile, not against habit.** Specifically:
   - Hit the profile's **Rhythm**: vary sentence length on purpose. After a long
     sentence, write a short one. Read it aloud in your head.
   - Use the profile's **Devices**, each at most once unless the voice is built on
     repetition. Don't import a device the profile doesn't list.
   - Open the way the profile opens (scene-first for reckoning,
     frame-first for measured-academic, point-first for plain).
   - Honor every line in the **Never** list.

4. **Measure before you hand it back.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json draft.txt
   ```
   - Score > 25 → it still reads as AI. Open the findings, fix each named tell,
     re-run. Common fixes: cut hollow-confidence words, break a uniform rhythm by
     splitting or merging sentences, delete a throat-clear opener.
   - Also check `metrics.sentenceLengthCV` against the profile's target. If it's
     below the voice's range, your rhythm is too flat regardless of score.

5. **Hand back** the prose plus a one-line scorecard: `voice: reckoning ·
   slop score 8/100 (A) · rhythm CV 0.56`. The score is why the user can trust it
   isn't generic.

## Notes

- The detector catches *tells*, not *good*. A clean score means no AI fingerprints,
  not that the piece is well-argued. You still owe real substance and structure.
- If the user's content genuinely needs a triad or a strong claim that trips a
  rule, keep it — the rules serve the writing, not the reverse. Say why in the
  handback so it's a choice, not an oversight.
