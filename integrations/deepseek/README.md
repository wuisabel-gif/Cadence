# Cadence for DeepSeek

DeepSeek supports **Skills** — markdown instructions you save once and toggle from the
drawer. [`cadence-skill.md`](cadence-skill.md) is a ready one: the writing laws and the
eight voices, so DeepSeek writes in a voice and strips AI tone.

## Install

1. Open the **Skills** drawer in DeepSeek chat.
2. Add a new Skill and paste the contents of [`cadence-skill.md`](cadence-skill.md)
   (or upload the file if your build accepts one).
3. Toggle it on for any chat where you want Cadence's guidance.

## The detector

DeepSeek chat can't run the detector itself, so score drafts in a terminal and bring
the result back:

```bash
npx cadence-deslop draft.txt
```

It returns the 0–100 score and every AI tell — the same numbers the rest of Cadence
uses. Same detector, every surface.
