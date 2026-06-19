# Tutorial: De-slop a whole repo

**Goal:** point Cadence at an entire repository, find the prose that reads as
AI-written, and clean it up — your own project or one you've cloned.

**You need:** Node 18 or newer. Nothing to install; `npx` fetches the tool on first
run. (Optional: the `/cadence` plugin in Claude Code, for the rewriting step.)

This walkthrough runs about ten minutes.

---

## Step 1 — Scan the repo

Point the detector at the folder. From anywhere:

```bash
npx cadence-deslop ./path/to/repo
```

It walks the whole tree, scores every prose file (`.md`, `.txt`, `.html`,
`.markdown`, `.rst`), and prints a table sorted worst-first:

```
Cadence de-slop  ·  31 files in ./path/to/repo  (worst first)
────────────────────────────────────────────────────
  F   88   docs/marketing/landing.md
  D   61   README.md
  C   34   docs/getting-started.md
  B   19   CONTRIBUTING.md
  A    7   docs/architecture.md
  …
────────────────────────────────────────────────────
  31 files   ·   avg 24   ·   worst 88 (docs/marketing/landing.md)
```

A few things happened for you automatically:

- Markdown is scored **prose-only** — fenced code and tables don't count, so a doc
  full of code samples isn't punished for it.
- HTML is reduced to its **visible text**, not its tags.
- `node_modules`, `dist`, `build`, and `.git` are **skipped**.

Read the table top-down. The **average** tells you the repo's overall health; the
**worst** line tells you where to start.

---

## Step 2 — Look at the worst offender

Score that one file on its own to see *why* it's flagged:

```bash
npx cadence-deslop ./path/to/repo/docs/marketing/landing.md
```

```
Cadence de-slop  ·  score 88/100  ·  grade F
words 412   sentences 23   avg len 17.9
rhythm variance (CV) 0.28  ⚠ too uniform

findings:
  banned-phrase (3): "In today's world", "When it comes to", "game-changer"
  hollow-confidence (5): "seamless", "robust", "powerful", ...
  negation-pivot (2): "It's not just a tool, it's a platform."
```

Now you know the work: flat rhythm, stock phrases, hollow words. The `⚠ too uniform`
on the rhythm line is the loudest signal — every sentence is about the same length.

---

## Step 3 — Fix it

**In Claude Code** (with the plugin installed), let Cadence rewrite it in place:

```
/cadence recast docs/marketing/landing.md in the punchy voice
```

It rewrites the prose, leaves any code or structure alone, and reports the drop
(`88 → 9`). For a Markdown or HTML file it edits the text and never the markup.

**By hand**, work down the findings: cut the banned phrases, replace each
hollow-confidence word with something concrete, and break the flat rhythm by
splitting and merging sentences until the lengths vary.

Either way, re-score the single file to confirm it lands at grade A or B.

---

## Step 4 — Re-scan and watch the average fall

Run the same scan from Step 1 again:

```bash
npx cadence-deslop ./path/to/repo
```

The file you fixed drops down the list, and the average at the bottom falls. Repeat
Steps 2–4 on the next file down. You're done when the worst score is one you're happy
to ship.

---

## Step 5 — Keep it clean in CI (optional)

Once a repo is clean, stop it from drifting back. Fail the build if any file slips:

```yaml
# .github/workflows/prose.yml
name: prose
on: [push, pull_request]
jobs:
  deslop:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npx cadence-deslop --strict ./docs   # exit 1 if any file scores > 25
```

Use `--max <n>` instead of `--strict` to set your own bar (for example, `--max 10`
to hold every doc to grade A).

---

## Step 6 — Pipe it into your own tools (optional)

`--json` turns the scan into data you can filter and chart however you like:

```bash
npx cadence-deslop --json ./docs > scores.json
npx cadence-deslop --json ./docs | jq '.[] | select(.score > 25) | .file'
```

Each entry is `{ "file": "...", "score": 0-100, "grade": "A"-"F" }`, already sorted
worst-first.

---

## A note on false alarms

If you scan a repo whose docs **name** the very tells Cadence looks for — a style
guide listing the buzzwords to avoid, or example pages full of deliberate slop —
those files will score high. That's correct: the slop is really in
the visible text. Skip them, or move the examples into fenced code blocks (which the
Markdown scan ignores).

That's the whole loop: **scan → read → fix → re-scan**, then gate it so it stays
clean. See [SOP.md](../SOP.md) for the day-to-day procedures and
[MANUAL.md](../MANUAL.md) for every flag.
