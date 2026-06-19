# Cadence

A Claude Code skill that makes AI-written prose sound like a person wrote it — and,
when you ask, like a *particular* person or in a tone you've chosen.

It learns a **voice** from a sample you give it (a book, an article, an essay,
your own past writing), saves that voice as a portable file, and writes in it.
Underneath sits a deterministic **de-slop detector** that scores any text and names
every AI tell in it, so a clean result is something you can verify, not just trust.

## Why it exists

Generic AI prose has a fingerprint: every sentence the same length, hollow
confidence words ("seamless," "robust"), reflexive triads ("fast, reliable, and
scalable"), the "it's not X, it's Y" seesaw, and throat-clearing openers ("In
today's world…"). Cadence targets that fingerprint directly — and gives you a
voice to write *toward*, not just tells to avoid.

## Commands

You type these in Claude Code as `/cadence <command>`:

| Command | What it does |
|---|---|
| `learn <sample>` | Reads a book/article/URL and extracts a reusable **voice profile** |
| `write <brief>` | Drafts new prose in a chosen voice |
| `recast <text>` | Rewrites existing text into a chosen voice, keeping the meaning |
| `deslop <text>` | Scores text and reports every AI tell — diagnose, then optionally fix |
| `voices` | Lists the voices you've learned plus the shipped seeds |

## Examples

Every score below comes straight from `skills/cadence/scripts/deslop.mjs` — reproduce them
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
thought, two profiles — notice the structure change, not just the wording.

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
profile to `voices/<name>.md`. The shipped **counsel** voice was built this way —
`voices/counsel.md` shows what a learned profile looks like.

## Voices that ship with it

- **counsel** — a philosopher answering a private worry; reframes your question
  into a better one.
- **reckoning** — scene first, then a hard truth.
- **measured-academic** — careful first-person reasoning that concedes before it
  concludes.
- **plain** — say it once, in the fewest honest words.
- **punchy** — high contrast; long build, short hit.

Add your own with `/cadence learn`. Profiles are plain markdown in `voices/` — read
them, edit them, share them.

## The detector

`skills/cadence/scripts/deslop.mjs` is the engine. It's pure Node, no dependencies, no
network. Run it standalone:

```bash
node skills/cadence/scripts/deslop.mjs draft.txt           # human report
node skills/cadence/scripts/deslop.mjs --json draft.txt     # machine-readable
cat draft.txt | node skills/cadence/scripts/deslop.mjs      # stdin
node skills/cadence/scripts/deslop.mjs --strict draft.txt   # exit 1 if score > 25 (CI gate)
```

It measures sentence-length variance (the strongest tell), a banned-phrase list,
hollow-confidence words, triad density, negation pivots, hedge-stacking, adverb and
em-dash rates — and returns a transparent 0–100 score plus a letter grade. Same
text, same score, every time.

## Install

Cadence is packaged as a Claude Code plugin, and this repo is its own marketplace.
Plugins are free — there's no store, no review, no fee.

**From GitHub (once this repo is pushed):**

```
/plugin marketplace add <your-org>/cadence
/plugin install cadence@cadence
```

**From a local clone (works today):**

```
/plugin marketplace add ~/cadence
/plugin install cadence@cadence
```

Then `/cadence write …`, `/cadence deslop …`, `/cadence learn …`, etc. are
available in a new session. New voices you create with `/cadence learn` are written
to a `voices/` folder in whatever project you're working in.

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
│           └── extract-text.mjs # pull prose from .pdf/.txt/.md for learning
├── voices/                      # shipped voice profiles (seed set)
└── tests/
    └── deslop.test.mjs          # 12 tests over the detector
```

## Test

```bash
npm test     # node --test tests/deslop.test.mjs
```

## Status

v0.1 — the detector and the five seed voices work and are tested, and the plugin is
packaged for install from this repo. Not yet published to a public marketplace.
