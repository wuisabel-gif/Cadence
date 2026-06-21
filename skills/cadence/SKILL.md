---
name: cadence
description: >-
  Use when the user wants to write, draft, rewrite, edit, or improve prose that
  sounds human instead of AI-generated — essays, posts, landing copy, emails,
  docs, scripts, newsletters, threads. Learns a reusable "voice" from a sample
  the user provides (a book, an article, their own past writing) and writes in
  it. Strips AI tone: hollow-confidence words, uniform sentence rhythm, triadic
  lists, negation-pivot clichés, throat-clearing openers. Use for "make this
  sound less like AI," "write this in the voice of X," "match my tone," "de-slop
  this draft," or building a library of tones to choose from. Not for code,
  data, or visual/UI design.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Cadence

Cadence makes AI-written prose sound like it was written by a person — and, when
the user asks, by a *particular* person or in a *particular* tone they've chosen.

Two engines do the work:

- **Voice profiles** (the positive target) — a structured spec of how one voice
  actually moves: its rhythm, diction, devices, stance, and bright lines. Learned
  from a sample, saved as a portable file, reused on demand. See
  `reference/voice-profile-schema.md`.
- **The de-slop detector** (the negative target) — `scripts/deslop.mjs`, a
  deterministic analyzer that scores text and names every AI tell in it. It is
  real code, not a prompt: the same draft scores the same every time, so you can
  show a before/after.

## Shared writing laws

These hold for every command. They are the difference between prose and slop.

1. **Rhythm is the strongest tell.** AI writing clusters every sentence around
   the same length. Human writing swings — a long accumulating sentence, then a
   short one. Vary it on purpose. Target a sentence-length CV ≥ 0.5.
2. **Concrete before abstract.** Show the case, then name the principle. A reader
   should be able to picture something before you ask them to think about it.
3. **No hollow confidence.** Never assert quality with adjectives ("seamless,"
   "robust," "powerful," "comprehensive"). Show the thing; let the reader
   conclude it's good.
4. **Cut the throat-clear.** No "In today's world," no "It's important to note,"
   no "When it comes to." Start on the actual first idea.
5. **No template rhetoric.** The negation-pivot ("It's not just X, it's Y"), the
   reflexive triad ("fast, reliable, and scalable"), and the "What if…" stack
   used three times are tics. Use a device once, with intent, or not at all.
6. **Earn every modifier.** If an adjective or adverb isn't load-bearing, delete
   it. Plain exact words beat decorated vague ones.
7. **A chosen voice overrides these defaults where it diverges.** A voice profile
   is the local law; these are the fallback when no voice is set.

## Setup

Before writing, establish two things:

1. **Which voice?** Look for the user's choice in the request ("vivid,"
   "punchy," "like my last post"). If they named a sample, learn it
   first (see `reference/learn.md`). If they named a tone you have, load it
   (see the two voice locations below). If neither, **show the voice picker**
   (below) and let them choose — don't silently pick for them. Default to the
   `plain` seed without asking only when the copy is plainly utilitarian (docs,
   UI strings, error text).

### Voice picker

When a command needs a voice and the user hasn't named one, read **every**
`voices/*.md` (the shipped seeds plus any the user has learned) and present them
as a numbered list — each voice's `label`, its one-line **Essence**, and a hint
of when to reach for it. Build the list from the files, never from memory, so it
always reflects what's installed (nine seeds ship today). Then ask the user to
pick a number or name, or to describe the feel they want so you can choose for
them. Example shape:

```
Pick a voice (or describe the feel you want):

  1. plain     — say it once, in the fewest honest words. Docs, UI copy.
  2. punchy    — long build, then a short hit. Landing pages, taglines.
  3. reckoning — set a scene, then a hard truth. Persuasion.
  …            — (continue through every file in voices/)
```
2. **What register?** Brand (design *is* the product — marketing, essays,
   landing) rewards distinctiveness; product (copy *serves* a UI — docs, app
   text) rewards plainness. Voice profiles carry a `register` hint.

Voices live in two places — read both with `ls` / `Glob` when listing or
resolving a voice:

- **Shipped seeds** at `${CLAUDE_PLUGIN_ROOT:-.}/voices/*.md` — `counsel`,
  `reckoning`, `measured-academic`, `plain`, `punchy`, `seminar`, `dispatch`,
  `column`, `kin`.
- **The user's own voices** at `voices/*.md` in their current project root
  (this is where `/cadence learn` writes new profiles). A user voice with the
  same name overrides a seed.

## Commands

When the user invokes `/cadence <command>`, load the matching reference file and
follow it. If they just describe a task, route by intent.

| Command | Intent | Load |
|---|---|---|
| `learn <sample>` | Extract a voice profile from a book/article/text/URL | `reference/learn.md` |
| `write <brief>` | Draft new prose in a chosen voice | `reference/write.md` |
| `recast <text>` | Rewrite existing text into a chosen voice | `reference/recast.md` |
| `deslop <text>` | Strip AI tells; report the score and every finding | `reference/deslop.md` |
| `voices` | List learned + seed voices and their essences | (read `voices/*.md` frontmatter) |

### When `/cadence` is invoked with no command (or an empty / unclear argument)

Do **not** guess a command and do **not** start writing. Present the menu below
verbatim, then stop and wait for the user to choose. The whole point is to guide
them to the right command — answer their situation, not a keyword.

```
**Cadence** — write in a voice, with less AI tone. What are you working on?

| If you want to… | Use | Example |
|---|---|---|
| See how AI-sounding a draft is | `deslop` | `/cadence deslop draft.md` |
| Rewrite text so it sounds human | `recast` | `/cadence recast post.md in the plain voice` |
| Write something new in a voice | `write` | `/cadence write a 150-word intro, punchy voice` |
| Teach Cadence a new voice from a sample | `learn` | `/cadence learn ~/essays/best.md` |
| See the voices you can pick from | `voices` | `/cadence voices` |

Not sure? Tell me what you have — a draft to fix, an idea to write, or a writer
you want to sound like — and I'll route it. Nine voices ship today; run
`/cadence voices` to read them.
```

After showing it, if the user describes a situation instead of naming a command,
route by intent: a draft to diagnose → `deslop`; existing text to improve →
`recast`; nothing written yet → `write`; a sample to imitate → `learn`.

## The detector is the ground truth

Every command that produces prose ends by running it through the detector:

```bash
node "${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/scripts/deslop.mjs" --json <draft-file>
```

If the score is above ~25, the draft still sounds like AI. Read the findings,
fix the named tells, and re-run. Do not hand back prose you haven't measured.
Report the final score to the user so they can trust it.
