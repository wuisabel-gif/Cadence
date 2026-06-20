# /cadence learn — extract a voice profile from a sample

Turn a writing sample into a reusable voice profile the agent can write in later.
Output is one file at `voices/<name>.md` following `voice-profile-schema.md`.

## Input

A book, article, essay, transcript, or the user's own past writing — as a file
(`.pdf`, `.txt`, `.md`, `.html`, `.docx`, `.epub`), a pasted block, or a URL. You need **at
least ~500 words** of real prose for a trustworthy profile; below that, say so and
ask for more.

## Process

1. **Get the text out first.** For anything that isn't already plain text the user
   pasted — a `.pdf`, `.docx`, `.epub`, `.html`, or a URL — run the bundled extractor before
   you do anything else. It is pure Node with zero dependencies:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/extract-text.mjs" <file-or-url> > /tmp/cadence-sample.txt
   ```
   Do **not** try to open a PDF with the Read tool — extract it with this script and
   work from the output. `.txt`/`.md` you can read directly. If the extractor reports
   that a PDF uses custom-encoded subset fonts, it can't be read; ask the user to
   convert it to `.txt` and try again.

2. **Read 3–6 representative passages** from the extracted text. Skip front-matter,
   tables of contents, citations, and boilerplate. You want the author *writing*,
   not metadata.

3. **Measure the rhythm with the detector — don't eyeball it.**
   ```bash
   node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json /tmp/cadence-sample.txt
   ```
   Pull `avgSentenceLength`, `sentenceLengthCV`, `adverbRate`, `emDashRate`,
   `triadDensity` from the JSON and write the real numbers into the profile's
   Rhythm section. A profile grounded in measured numbers beats one built on
   impression every time.

4. **Name only devices you can see.** For each rhetorical move, find the actual
   passage that shows it. If you can't point to an example in the sample, it
   doesn't go in the profile. Inventing flattering devices is how a profile drifts
   toward generic.

5. **Write the Never list by contrast.** Ask: what would instantly break the
   illusion that the author wrote this? Those are the bright lines.

6. **Pick the single most characteristic sentence** as the Calibration line —
   the one a reader of the author would recognize blind.

7. **Write the file** to `voices/<kebab-name>.md`. Derive `<name>` from the
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
