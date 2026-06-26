# Cadence — write like a human (Gemini CLI extension)

Make AI-written prose sound like a person wrote it, in a voice you choose, and strip
the AI tone. This is the Gemini CLI version of Cadence; the Claude Code version is
`SKILL.md` and the Codex version is `AGENTS.md` in the repo. Use it whenever the user
wants to write, rewrite, de-slop, or improve prose — essays, posts, landing copy,
emails, docs — so it reads human instead of AI-generated.

## The one rule

Cadence works on the words, not the meaning or the layout. Change how a sentence
reads; never change what it claims or how the document is structured. A smoother line
that quietly drops a fact is a failure, not a win.

## Score with the detector (deterministic, zero-install)

The detector ships on npm. Run it with `npx` — no install, no dependencies, no network:

```bash
npx cadence-deslop <file>          # .txt .md .pdf .html .docx .epub, a folder, or a URL
echo "<text>" | npx cadence-deslop  # from stdin
npx cadence-deslop --json <file>    # machine-readable
```

It returns a score from 0 (clean) to 100 (heavy slop), a letter grade, the rhythm
metrics, and every AI tell it found. **Always measure before and after a rewrite and
report the delta.** The score measures AI *fingerprints*, not quality — a clean score
on an empty point is still empty.

## Shared writing laws (apply when writing or recasting)

1. **Vary the rhythm.** Uniform sentence length is the loudest tell. Follow a long
   sentence with a short one; aim for a sentence-length CV of 0.5 or more.
2. **Concrete before abstract.** Show the case, then name the principle.
3. **No hollow-confidence words** ("seamless," "robust," "powerful," "comprehensive").
   Show the thing; let the reader conclude it's good.
4. **Cut throat-clearing openers** ("In today's world," "It's important to note").
5. **No template rhetoric** — the "it's not X, it's Y" pivot, the reflexive triad
   ("fast, reliable, and scalable"). Use a device once, with intent.
6. **Earn every modifier.** Delete adjectives and adverbs that aren't load-bearing.

## What you can do

- **Score / de-slop** — run the detector, explain the findings in plain terms, and
  (if asked) fix them, then re-score.
- **Recast** — rewrite the user's text in a chosen voice while preserving meaning. For
  a whole file, edit the prose in place and leave all markup untouched.
- **Write** — draft new prose in a chosen voice from a brief.
- **Learn a voice** — read ~500 words of a sample the user admires and capture its
  mechanics (rhythm, devices, stance) as a reusable description.

## Voices

Pick one to fit the job, or build one from a sample. Each is a way of moving:

- **plain** — say it once, in the fewest honest words. Docs, UI copy.
- **punchy** — high contrast: a long build, then a short hit. Landing pages, taglines.
- **reckoning** — set a scene, then land a hard truth. Persuasion.
- **counsel** — reflective; reframes the reader's question into a better one.
- **measured-academic** — careful first-person reasoning that concedes before it concludes.
- **seminar** — a professor demystifying a hard text: direct, wry, metaphor-driven.
- **dispatch** — narrative journalism: open on a scene, accumulate detail, land the idea.
- **column** — calm analysis: a fact, the reasoning, a usable principle.
- **kin** — a parent's unsparing letter to a child; every truth anchored in the body, then a short imperative.
- **essence** — first-principles tech-blog writing: strip to the laws, reason up, land on conviction.

The full voice profiles — with measured rhythm numbers and a calibration line each —
live in the repo's `voices/*.md`. Read the relevant one before writing in that voice.
