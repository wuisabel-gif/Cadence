# Voice profile schema

A voice profile is a portable markdown file that tells the agent how to write in
one specific voice. It is the **positive** target; the de-slop detector is the
negative one. Profiles live in `voices/` (shipped seeds) or in the user's project
root under `voices/` (voices they've learned).

Each profile is judged on whether a writer could hit the voice from the file
alone, without the original sample in front of them. Vague profiles ("formal,
clear, engaging") are worthless. Capture the *mechanics*.

## Required sections

```markdown
---
name: <kebab-case-id>
label: <Human Readable Name>
source: <where it was learned from — title, author, URL, or "preset">
register: <brand | product | either>   # optional, mirrors impeccable's register idea
---

# <Label>

**Essence** — one sentence naming what makes this voice itself, not a neighbor.

## Rhythm
- Target average sentence length and, more importantly, the *swing*: does it run
  long then snap short? Give the pattern, not just a number.
- Paragraph shape (short stacked / long flowing / mixed).

## Diction
- Vocabulary floor: plain Anglo-Saxon, mid, or elevated/Latinate.
- Words and constructions it reaches for.
- Words and constructions it refuses.

## Devices
- The rhetorical moves it actually uses (rhetorical-question cascade, concrete
  example after a claim, direct address, concession, aphoristic close, etc.).
- For each, a one-line "how to deploy it here."

## Stance
- Relationship to the reader (peer, guide, skeptic, teacher).
- Certainty posture: does it concede openly, qualify, or assert hard?

## Structure habits
- How it opens a piece and a paragraph.
- Concrete-before-abstract? Claim-then-evidence? Signpost the argument?

## Never
- The bright lines. Things this voice does not do, ever. This list is what keeps
  a rewrite from drifting back toward generic.

## Calibration line
- One sentence (real or faithfully imitated) that is unmistakably this voice.
  The writer re-reads this before drafting to re-acquire the ear.
```

## How `/voice learn` fills it in

1. Read the sample (PDF/text/URL). Pull 3–6 representative passages.
2. Run `deslop.mjs --json` on the sample to measure its real rhythm numbers
   (avgSentenceLength, sentenceLengthCV, adverbRate, emDashRate) and write those
   into Rhythm so the profile is grounded in data, not impression.
3. Name the devices you can *see* in the passages. Do not invent ones that would
   be nice — only ones present.
4. Write the Never list from contrast: what would immediately break the illusion?
5. Pick the single most characteristic sentence as the Calibration line.
