<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="Cadence logo: five rhythm bars of uneven height, one in red">
</p>

<h1 align="center">Cadence</h1>

<p align="center"><b>An AI-text humanizer for Claude Code — write in a voice you choose, with less AI tone.</b></p>

<p align="center">
  <a href="https://github.com/wuisabel-gif/Cadence/actions/workflows/ci.yml"><img src="https://github.com/wuisabel-gif/Cadence/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/cadence-deslop"><img src="https://img.shields.io/npm/v/cadence-deslop?color=2348a1&label=npm%20%C2%B7%20cadence-deslop" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2348a1" alt="MIT license"></a>
  <img src="https://img.shields.io/badge/dependencies-0-2348a1" alt="zero dependencies">
</p>

> 📐 **Verified by Cadence** — this README's own prose scores grade A on the detector. The slop quoted in the examples below is there on purpose.

You can usually tell when a machine wrote something. Not from any single word — from
the texture. The sentences come out the same length. Every paragraph opens with a
transition. The point gets hedged, then the hedge gets hedged. There are three
examples where one would have landed harder. You may not be able to underline the
broken part, but you feel it, and the moment you feel it you start to skim.

Cadence exists to strip that signature out. (It's an AI-text humanizer, if you want
the search term — but one that shows its work.)

## What it's for

Two things. It scores prose for how machine-made it reads, and it recasts prose so it
reads like a person wrote it. The score is your baseline and your to-do list. The
recast is the fix.

**The one rule it never breaks:** Cadence works on the words, not the meaning or the
layout. It changes how a sentence reads. It does not touch what the sentence claims, or
how the document is built. A smoother line that quietly drops a fact is a failure, not
a win.

## Why rhythm, not grammar

Slop isn't a grammar problem. AI prose is often spotless and still obviously synthetic,
because the tell is rhythmic. Real writing breathes — a long, winding clause that earns
its commas, then a stop. Machine writing flatlines at one comfortable length, sentence
after sentence after sentence.

So the number Cadence watches hardest is **rhythm variance** (CV). Even, same-length
sentences are the loudest fingerprint there is. If a rewrite doesn't move the variance,
it didn't rewrite anything; it swapped synonyms and called it done.

## Why bother

Flat prose costs you the reader. People trust writing that sounds like a person meant
it. The moment a page reads as generated, your argument inherits the doubt — even a
good argument, even a true one.

A clean score is not the goal, though. Clarity is. A spotless score on an empty point
is still an empty point. Find the real thing you have to say, say it in a voice, and
let the low score fall out as a side effect.

## Commands

You type these in Claude Code as `/cadence <command>`:

| Command | What it does |
|---|---|
| `learn <sample>` | Reads a book/article/URL and extracts a reusable **voice profile** |
| `write <brief>` | Drafts new prose in a chosen voice |
| `recast <text>` | Rewrites existing text into a chosen voice, keeping the meaning |
| `deslop <text>` | Scores text and reports every AI tell — diagnose, then optionally fix |
| `voices` | Lists the voices you've learned plus the shipped seeds |

New here? **[SOP.md](SOP.md)** is the step-by-step playbook. Every command and CLI
flag is documented in **[MANUAL.md](MANUAL.md)**.

## Examples

Every score below comes straight from `skills/cadence/scripts/deslop.mjs`. Reproduce them
with the commands shown.

### `deslop` then `recast` — strip the AI tells

Start with raw model marketing copy:

> In today's world, finding the right productivity app can be a daunting task. Our
> cutting-edge platform leverages powerful AI to seamlessly streamline your
> workflow. Whether you're a busy professional or a student, our comprehensive
> solution empowers you to do more. It's not just an app, it's a game-changer.
> When it comes to getting things done, we've got you covered.

```bash
node skills/cadence/scripts/deslop.mjs before.txt
```
```
Cadence de-slop  ·  score 61/100  ·  grade D
  banned-phrase (4): "In today's world", "When it comes to", "game-changer", "Whether you're"
  hollow-confidence (5): "seamlessly", "powerful", "comprehensive", "cutting-edge", "streamline"
  negation-pivot (1): "It's not just an app, it's a game-changer."
  cliche-opener (1): "When it comes to getting things done…"
```

`/cadence recast` into the **plain** voice, fixing each named tell:

> Most productivity apps add work instead of removing it. This one starts with your
> real day. It reads what's due and what's blocking you, then shows the single next
> thing to do. Students use it. So do people running teams. You won't get a
> dashboard to admire. You'll get fewer open tabs.

```
Cadence de-slop  ·  score 0/100  ·  grade A     (61 → 0)
```

### `write` — one idea, two voices

Brief: *"reassure someone who feels they're falling behind their peers."* Same
thought, two profiles. Notice the structure change, not just the wording.

**`/cadence write --voice counsel`** (reframes the question; long-wind-then-snap rhythm):

> You open the app and everyone is ahead of you. Engaged, promoted, somewhere
> sunlit. Underneath is a quiet arithmetic: they have more, so I have less, so I
> must be less.
>
> But notice what that smuggles in. It assumes one shared finish line, and that
> the people posting are reporting rather than performing. Neither holds. Nobody
> posts the afternoon they spent staring at the ceiling.
>
> Here is a question to set beside "am I falling behind?" — behind whom, and
> toward what? Name the finish line and you usually can't. The race dissolves.

`score 0/100 · grade A · rhythm CV 0.57`

**`/cadence write --voice reckoning`** (scene first, hard truth, aphoristic close):

> At your ten-year reunion someone will have the house, the title, the symmetrical
> children, and you will do the math on the drive home. Here is what the math
> leaves out. Every person in that room ran a different race on a different track,
> and the clock you keep reading was never theirs to begin with. The comparison
> isn't wrong. It is measuring nothing. You are not behind. There is no line to be
> behind.

`score 0/100 · grade A`

### `learn` — add your own voice

```
/cadence learn https://example.com/an-essay-you-love
/cadence learn ~/writing/my-best-newsletter.txt
```

Cadence reads the sample, measures its real rhythm with the detector, and writes a
profile to `voices/<name>.md`. The shipped **counsel** voice was built this way.
`voices/counsel.md` shows what a learned profile looks like.

## Voices that ship with it

- **counsel** — a philosopher answering a private worry; reframes your question
  into a better one.
- **reckoning** — scene first, then a hard truth.
- **measured-academic** — careful first-person reasoning that concedes before it
  concludes.
- **plain** — say it once, in the fewest honest words.
- **punchy** — high contrast; long build, short hit.
- **seminar** — a professor demystifying a hard text; direct, wry, metaphor-driven.
- **dispatch** — narrative science-journalism: open on a scene, then land the idea.
- **column** — calm analytical essay: a fact, the reasoning, a usable principle.

Add your own with `/cadence learn`. Profiles are plain markdown in `voices/`. Read
them, edit them, share them.

## The detector

The detector is the front door — try it in five seconds, no install:

```bash
npx cadence-deslop draft.txt          # any file: .txt .md .pdf .html .docx
npx cadence-deslop ./some-repo        # scan a whole folder/repo, ranked worst-first
npx cadence-deslop page.html          # scores the visible text of a web page
npx cadence-deslop https://a.blog/post  # fetch a live URL and score it
pbpaste | npx cadence-deslop          # score whatever's on your clipboard
npx cadence-deslop --json draft.txt   # machine-readable JSON
npx cadence-deslop --strict draft.txt # exit 1 if score > 25 (CI gate)
```

`deslop.mjs` is the engine — pure Node, zero dependencies. It only reaches the
network if you hand it a URL. Run it from a clone the same way:

```bash
node skills/cadence/scripts/deslop.mjs draft.txt
cat draft.txt | node skills/cadence/scripts/deslop.mjs
```

It measures sentence-length variance (the strongest tell), a banned-phrase list,
hollow-confidence words, triad density, negation pivots, hedge-stacking, adverb and
em-dash rates. It returns a transparent 0–100 score plus a letter grade. Same
text, same score, every time.

## Install

**The full plugin.** It writes in voices and learns new ones from samples. Cadence is
a Claude Code plugin, and this repo is its own marketplace; plugins are free, with no
store and no fee:

```
/plugin marketplace add wuisabel-gif/Cadence
/plugin install cadence@cadence
```

Then `/cadence write …`, `/cadence deslop …`, `/cadence learn …`, etc. are available
in a new session. New voices you create with `/cadence learn` are written to a
`voices/` folder in whatever project you're working in. (Developing on Cadence? Point
the marketplace at a local clone instead: `/plugin marketplace add ~/cadence`.)

**Just the detector.** Score prose anywhere, no plugin needed:

```bash
npx cadence-deslop draft.txt     # run it without installing
npm install -g cadence-deslop    # or install the `cadence-deslop` / `deslop` command
```

## Documentation

| Document | What it covers |
|---|---|
| [SOP.md](SOP.md) | Step-by-step playbook: how to de-slop, write, recast, and learn a voice |
| [tutorials/scan-a-repo.md](tutorials/scan-a-repo.md) | Tutorial: audit and de-slop an entire repo, then gate it in CI |
| [MANUAL.md](MANUAL.md) | Full reference for every command, CLI flag, input format, and exit code |
| [PHILOSOPHY.md](PHILOSOPHY.md) | The thinking behind it — *The Age of Taste* |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How the project is built and how to add a rule, voice, or command |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [LICENSE](LICENSE) | MIT |

Each of these is scored by the detector on every push and must stay grade A.

## Layout

```
cadence/
├── .claude-plugin/
│   ├── plugin.json              # plugin manifest
│   └── marketplace.json         # marketplace catalog (this repo lists itself)
├── skills/
│   └── cadence/
│       ├── SKILL.md             # router, shared writing laws, setup
│       ├── reference/           # one file per command + the voice schema
│       └── scripts/
│           ├── deslop.mjs       # the detector (real code, tested)
│           └── extract-text.mjs # pure-Node prose extraction from .pdf/.txt/.md
├── voices/                      # shipped voice profiles (seed set)
└── tests/                       # 27 tests — `npm test`
    ├── deslop.test.mjs
    └── extract-text.test.mjs
```

## Test

```bash
npm test          # 27 tests over the detector and the extractors
npm run check:docs  # dogfood: the repo's own docs must score grade A
```

## Status

v0.1 — the detector and the eight seed voices work and are tested, and the plugin is
packaged for install from this repo. Not yet published to a public marketplace.
