# Contributing to Cadence

Cadence has one job: make AI-written prose sound human, in a voice you choose.
Contributions are easiest to accept when they hold that line. Here is how the
project works and what a good change looks like.

## Principles

Three rules shape almost every decision.

1. **The detector stays deterministic and dependency-free.** `deslop.mjs` is plain
   Node — no packages, no network. Same text, same score, every time. A change that
   adds a dependency or makes scores wobble gets sent back.
2. **Every example is real detector output.** The README, the site, and the docs
   only show numbers the detector actually produced. Add an example, run it through
   `deslop.mjs`, paste the real result.
3. **Voices teach mechanics, not quotes.** A profile captures how a voice moves —
   its rhythm, its devices, the stance it takes. It never reproduces a source's sentences or
   names them. Write original calibration lines; label sources by register.

## Setup

```bash
git clone https://github.com/wuisabel-gif/Cadence.git
cd Cadence
npm test
```

Nothing to install. The detector, the extractors, and their 27 tests run on
Node ≥ 18 with no dependencies. Score a draft:

```bash
node skills/cadence/scripts/deslop.mjs --json some-draft.txt
```

## Layout

```
skills/cadence/
  SKILL.md          # router: writing laws, setup, command table
  reference/        # one file per command, plus the voice schema
  scripts/deslop.mjs
voices/             # shipped voice profiles
tests/deslop.test.mjs
.claude-plugin/     # plugin.json + marketplace.json
```

## What you can add

### A detector rule

A good rule catches a real, nameable AI tell and stays silent on human prose. Work
test-first.

1. Add cases to `tests/deslop.test.mjs`: one passage that should trip the rule, one
   human passage that must not. Run `npm test` and watch them fail.
2. Write a pure function in `deslop.mjs` — text in, `[{ rule, severity, snippet }]`
   out. No DOM, no I/O, no globals.
3. Wire it into `analyze()`. If it moves the score, add a transparent term with a
   comment explaining the weight.
4. Re-run the tests, then check the rule against the README's clean examples. One
   that flags the human specimens is too loud — tune it down.

Keep the false-positive bar high. A noisy rule is worse than no rule.

### A voice

Voices live in `voices/<name>.md` and follow the schema in
[`skills/cadence/reference/voice-profile-schema.md`](skills/cadence/reference/voice-profile-schema.md).

1. Measure, don't guess. Run a real sample through `deslop.mjs --json` and write the
   actual rhythm numbers into the profile.
2. Name only the devices you can point to in the sample.
3. Write an original calibration line in the voice — don't paste the source. Set
   `source:` to a register label, not an author or a title.
4. Shipping it as a seed? Add it to the seed list in `SKILL.md` and the catalogue on
   the site.

### A command

Commands are arguments to the one `cadence` skill, not separate skills.

1. Write `skills/cadence/reference/<command>.md` — the flow the agent follows.
2. Add a row to the Commands table in `SKILL.md`.
3. If the command writes prose, its reference must tell the agent to score the
   result with `deslop.mjs` before handing it back. That loop is the product.

## Code style

- Plain ES modules. No TypeScript, no build step — the detector is read and run
  directly.
- No dependencies. If you think you need one, open an issue first; the answer is
  usually "write the twenty lines instead."
- Pure functions over the text. Keep the CLI a thin wrapper at the bottom of the
  file.
- Comment the *why* behind a threshold or a weight, not the what.

## Prose in the docs

This is a writing tool, so its own copy should pass its own bar. Before you touch the
README, the site, or a command editorial, run the prose through the detector and fix
what it flags. Practice what we detect. CI enforces this: `npm run check:docs` scores
the docs with `--prose-only` (skipping code, quotes, and tables) and fails if any
drops below grade A, so the "Verified by Cadence" badge can't quietly become a lie.

## Pull requests

- One focused change per PR — a rule, a voice, or a command, not all three.
- `npm test` passes. New behavior brings new tests.
- Plain commit messages: what changed, and why.
- Contributing means licensing your work under the [MIT License](LICENSE).

Bigger idea? Open an issue before you build it, so we can shape it together.
