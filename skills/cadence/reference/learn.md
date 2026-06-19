# /cadence learn — extract a voice profile from a sample

Turn a writing sample into a reusable voice profile the agent can write in later.
Output is one file at `voices/<name>.md` following `voice-profile-schema.md`.

## Input

A book, article, essay, transcript, or the user's own past writing — as a file
(`.pdf`, `.txt`, `.md`, `.docx`), a pasted block, or a URL. For PDFs, extract
text with the bundled `scripts/extract-text.mjs` (pure Node, no dependencies). If
a PDF uses custom-encoded subset fonts and extraction fails, convert it to `.txt`
first. You need **at least ~500 words** of real prose to get a
trustworthy profile; below that, say so and ask for more.

## Process

1. **Read 3–6 representative passages.** Skip front-matter, tables of contents,
   citations, and boilerplate. You want the author *writing*, not metadata.

2. **Measure the rhythm with the detector — don't eyeball it.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json sample.txt
   ```
   Pull `avgSentenceLength`, `sentenceLengthCV`, `adverbRate`, `emDashRate`,
   `triadDensity` from the JSON and write the real numbers into the profile's
   Rhythm section. A profile grounded in measured numbers beats one built on
   impression every time.

3. **Name only devices you can see.** For each rhetorical move, find the actual
   passage that shows it. If you can't point to an example in the sample, it
   doesn't go in the profile. Inventing flattering devices is how a profile drifts
   toward generic.

4. **Write the Never list by contrast.** Ask: what would instantly break the
   illusion that the author wrote this? Those are the bright lines.

5. **Pick the single most characteristic sentence** as the Calibration line —
   the one a reader of the author would recognize blind.

6. **Write the file** to `voices/<kebab-name>.md`. Derive `<name>` from the
   author or the tone (`reckoning`, `my-newsletter`). Fill every schema
   section. Confirm the path back to the user and show the Essence + Calibration
   line so they can sanity-check the read.

## Quality bar

A good profile lets a writer hit the voice **without the original sample in
front of them**. Re-read your draft profile and ask: could I write a convincing
paragraph from this alone? If the answer is "only if I already knew the author,"
the profile is too vague — go back to the passages and capture the mechanics.

## Pitfalls

- **Profiling a translated or heavily-edited text** flattens the voice. Note the
  source's nature if it's a translation.
- **Mixing two authors in one sample** produces a muddy profile. One voice per
  file.
- **Over-long Never lists** become unusable. Keep it to the 4–6 lines that
  actually matter.
