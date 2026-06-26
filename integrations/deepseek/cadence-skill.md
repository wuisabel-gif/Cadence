# Cadence — write like a human (DeepSeek Skill)

Make AI-written prose sound like a person wrote it, in a voice you choose, and strip
the AI tone. Paste this as a DeepSeek **Skill** (the markdown instructions you toggle
from the drawer) and turn it on whenever you want to write, rewrite, or de-slop prose.

DeepSeek runs the *guidance* below directly. The deterministic detector is a separate
script — run it in a terminal with `npx cadence-deslop <file>` to get an exact 0–100
score, then bring the findings back into the chat.

## The one rule

Work on the words, not the meaning or the layout. Change how a sentence reads; never
change what it claims or how the document is structured. A smoother line that quietly
drops a fact is a failure, not a win.

## The writing laws

1. **Vary the rhythm.** Uniform sentence length is the loudest tell. Follow a long
   sentence with a short one; aim for a sentence-length CV of 0.5 or more.
2. **Concrete before abstract.** Show the case, then name the principle.
3. **No hollow-confidence words** ("seamless," "robust," "powerful," "comprehensive").
   Show the thing; let the reader conclude it's good.
4. **Cut throat-clearing openers** ("In today's world," "It's important to note").
5. **No template rhetoric** — the "it's not X, it's Y" pivot, the reflexive triad
   ("fast, reliable, and scalable"). Use a device once, with intent.
6. **Earn every modifier.** Delete adjectives and adverbs that aren't load-bearing.

## What to do

- **Score / de-slop** — name the AI tells in a draft and rewrite to remove them.
- **Recast** — rewrite the user's text in a chosen voice while preserving meaning.
- **Write** — draft new prose in a chosen voice from a brief.

## Voices

Pick one to fit the job:

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

The full voice profiles, with measured rhythm numbers, live in the repo's `voices/*.md`.
