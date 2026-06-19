# Cadence Manual

The complete reference for the `/cadence` skill commands and the `cadence-deslop`
command-line tool. For the why, see [PHILOSOPHY.md](PHILOSOPHY.md); for how to help,
see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 1. The `/cadence` skill (inside Claude Code)

Install once, then type these at the Claude Code prompt, or just ask in plain words.

| Command | What it does | Example |
|---|---|---|
| `/cadence write <brief>` | Draft new prose in a chosen voice | `/cadence write a 150-word launch intro in the punchy voice` |
| `/cadence learn <sample>` | Build a reusable voice profile from a sample | `/cadence learn ~/essays/my-best.md` |
| `/cadence recast <text\|file>` | Rewrite existing text into a voice, keeping meaning | `/cadence recast index.html in the plain voice` |
| `/cadence deslop <text\|file>` | Score text and name every AI tell (no edits) | `/cadence deslop draft.md` |
| `/cadence voices` | List available voices | `/cadence voices` |

**Diagnose vs. fix:** `deslop` only *reports*. `recast` *rewrites*. For a whole file,
`recast` edits the prose in place and leaves all markup (HTML tags, Markdown fences,
frontmatter) untouched.

**Shipped voices:** `counsel`, `reckoning`, `measured-academic`, `plain`, `punchy`.
Add your own with `/cadence learn`; profiles are plain Markdown in `voices/`.

---

## 2. The `cadence-deslop` CLI

The detector on its own. Pure Node, zero dependencies. Run it three ways:

```bash
npx cadence-deslop <file>            # no install
node skills/cadence/scripts/deslop.mjs <file>   # from a clone
cat draft.txt | cadence-deslop       # from stdin
```

### Arguments

| Argument | Effect |
|---|---|
| `<file>` | Score a file. Auto-detects type by extension (see Input formats). |
| *(stdin)* | With no file, reads text from standard input. |
| `--html` | Treat input as HTML: score the visible text, skip tags/scripts/styles. Auto-enabled for `.html`/`.htm` files; use the flag for stdin. |
| `--prose-only` | Treat input as Markdown: skip fenced code, blockquotes, tables, and HTML. Use it to score a `.md` doc's prose, not its examples. |
| `--json` | Output the full result as JSON instead of the human report. |
| `--strict` | Exit with code `1` if the score exceeds **25** (a CI gate). |
| `--max <n>` | Exit with code `1` if the score exceeds **n**. Overrides `--strict`. |
| `-h`, `--help` | Print usage and exit. |
| `-v`, `--version` | Print the version and exit. |

### Input formats

| Extension | Handling |
|---|---|
| `.txt`, `.md` | Scored as-is. Add `--prose-only` to skip Markdown code/quotes/tables. |
| `.html`, `.htm` | Auto-stripped to visible text, then scored. |
| `.pdf` | Text extracted with built-in `zlib` (no pypdf). Subset-font PDFs fail with a clear message — convert to `.txt`. |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Ran successfully (and, under `--strict`/`--max`, stayed within the limit). |
| `1` | `--strict`/`--max` threshold exceeded. |

### Examples

```bash
cadence-deslop draft.txt                 # human report
cadence-deslop page.html                 # score a web page's visible copy
cadence-deslop --json draft.md           # machine-readable
cadence-deslop --prose-only README.md    # score the prose, not the code samples
cadence-deslop --strict post.md          # fail (exit 1) above score 25
cadence-deslop --max 10 README.md        # fail unless grade A
pbpaste | cadence-deslop --html          # score HTML from the clipboard
```

---

## 3. Reading the output

```
Cadence de-slop  ·  score 44/100  ·  grade C
──────────────────────────────────────────────
words 34   sentences 4   avg len 8.5
rhythm variance (CV) 0.24  ok
adverb rate 0/100   em-dash rate 0/100   triad density 0.25

11 findings:
  banned-phrase (2): "In today's world", "When it comes to"
  hollow-confidence (6): "seamless", "robust", ...
```

**Score** runs 0 (clean) to 100 (heavy slop). **Grade** maps the score:

| Grade | Score |
|---|---|
| A | 0 – 10 |
| B | 11 – 25 |
| C | 26 – 45 |
| D | 46 – 70 |
| F | 71 – 100 |

**Metrics** (also in `--json` under `metrics`):

| Field | Meaning |
|---|---|
| `words`, `sentences`, `avgSentenceLength` | Basic counts. |
| `sentenceLengthCV` | Rhythm variance. Higher is more human; under ~0.4 is flat. |
| `uniformRhythm` | `true` when the rhythm is too even (the strongest tell). |
| `adverbRate`, `emDashRate` | Per-100-word rates. |
| `triadDensity` | Three-item lists per sentence. |

**Finding rules:** `banned-phrase`, `hollow-confidence`, `triad`, `negation-pivot`,
`hedge-stack`, `cliche-opener`. Each finding has a `rule`, `severity`, and `snippet`.

---

## 4. The `extract-text` helper

Used by `/cadence learn` to pull prose from a file. Run it directly if you like:

```bash
node skills/cadence/scripts/extract-text.mjs <file.pdf|.txt|.md|.html>   # prose to stdout
```

Exit `2` for a usage error or unsupported type; exit `3` when no readable text can be
extracted.

---

## 5. npm scripts (from a clone)

| Script | Does |
|---|---|
| `npm test` | Run the test suite (detector + extractors). |
| `npm run deslop -- <file>` | Run the detector locally. |
| `npm run check:docs` | Score the repo's own docs; fail if any drops below grade A. |
