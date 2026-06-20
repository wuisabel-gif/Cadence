# Cadence Manual

Everything in one place: how to install and activate Cadence, how to use it day to
day, and the full reference for every command and flag. For the reasoning behind it
all, see [PHILOSOPHY.md](PHILOSOPHY.md); to contribute, [CONTRIBUTING.md](CONTRIBUTING.md).

**The one rule it never breaks:** Cadence works on the words, not the meaning or the
layout. It changes how a sentence reads. It does not change what it claims or how the
document is built. A smoother line that drops a fact is a failure, not a win.

---

## 1. Install & activate

There are two ways to use Cadence:

- **The full plugin** — the `/cadence` skill (write, recast, learn, deslop, voices),
  which runs inside **Claude Code**.
- **The detector only** — `cadence-deslop`, the scorer on its own, which runs
  anywhere with Node and needs no Claude Code.
- **The Chrome extension** — the detector in your browser (popup or right-click).
  See [extension/README.md](extension/README.md).

### Where the plugin runs

The `/cadence` plugin loads only in **Claude Code**: the `claude` command in a
terminal, the Claude Code extension in VS Code / JetBrains, or the Claude Code mode
of the desktop app (the session where Claude can run commands and edit files). It
does **not** load in the claude.ai website or the desktop app's regular chat. If
`/cadence` isn't recognized, you're almost certainly in a regular chat — switch to a
Claude Code session.

### Install the plugin

Interactive, in a Claude Code session — both steps matter, since `marketplace add`
only makes Cadence available and `install` is what turns it on:

```
/plugin marketplace add wuisabel-gif/Cadence
/plugin install cadence@cadence
```

Or non-interactively, by editing `~/.claude/settings.json`. Note that
`enabledPlugins` is an **object**, not an array:

```json
{
  "extraKnownMarketplaces": {
    "cadence": { "source": { "source": "git", "url": "https://github.com/wuisabel-gif/Cadence.git" } }
  },
  "enabledPlugins": { "cadence@cadence": true }
}
```

Start a fresh Claude Code session afterward (or run `/reload-plugins`), since skills
load at startup.

### Verify

```
/cadence voices
```

You should see nine voices: counsel, reckoning, measured-academic, plain, punchy,
seminar, dispatch, column, epistle. Once it loads, skip the slash command and just ask —
*"score this draft,"* *"recast this in the column voice."*

### If it won't activate

| Symptom | Cause | Fix |
|---|---|---|
| `/cadence` not recognized; Claude talks about your files instead | You're in a regular chat, not Claude Code | Open a Claude Code session |
| Added the marketplace but nothing happens | The plugin was never installed | `/plugin install cadence@cadence`, or set `enabledPlugins` |
| `enabledPlugins` rejected by validation | It was written as an array | It must be an object: `{ "cadence@cadence": true }` |
| Enabled but the skill doesn't appear | Skills load at startup | New session, or `/reload-plugins` |
| Loads but voices/detector not found | A same-named personal skill shadows the plugin | `rm ~/.claude/skills/cadence`, then restart |
| `claude: command not found` | The CLI isn't installed | `npm install -g @anthropic-ai/claude-code`, then `claude` |

---

## 2. The commands

Type these at the Claude Code prompt, or just ask in plain words.

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

---

## 3. Workflows

Short sequences you can follow start to finish.

### De-slop a draft (the common case)

1. **Diagnose first** — *"score this draft."* The score is your baseline; the
   findings are your to-do list.
2. **Pick a voice** if you want character (§4), or let it default to `plain`.
3. **Recast** — *"rewrite this to remove the AI tells,"* naming a voice if you chose
   one.
4. **Read the delta** — Cadence reports `score 58 → 7` with before/after sentences.
   If the score barely moved, it paraphrased; tell it to actually vary the rhythm.
5. **Check the meaning survived.** You own this step. A lower score with a changed
   claim is a failure.

### Write something new in a voice

1. **Have the substance first** — the point, the example, the takeaway. Voice is
   delivery, not a substitute for having something to say.
2. **Ask with a concrete brief** — *"write a 150-word product intro in the punchy
   voice."* Specify length; it keeps the draft tight.
3. **Confirm the score** it hands back. Grade A or B is the bar.

### Recast a whole file (HTML, Word, Markdown)

1. **Point Cadence at the file** — *"de-slop landing.html in the plain voice."*
2. It scores the file, then rewrites the prose **in place** — the text inside `<p>`,
   headings, list items — leaving tags, classes, and structure untouched.
3. It **skips text meant to be slop** (a quoted bad example) rather than "fixing" it.
4. It re-scores and confirms the markup is unchanged.

### Learn a voice from writing you admire

1. **Gather a real sample** — at least ~500 words. A file (`.pdf`, `.txt`, `.md`,
   `.html`, `.docx`, `.epub`), a pasted block, or a URL.
2. **Ask** — *"learn a voice from this essay"* (`/cadence learn <source>`).
3. Cadence measures the sample's real rhythm and writes a profile to
   `voices/<name>.md` in your project.
4. **Read the profile** it shows you. If it doesn't sound like the source, give it a
   longer or cleaner sample.
5. **Use it** by name in any later `write` or `recast`.

### Score only (no plugin needed)

```bash
npx cadence-deslop draft.md          # a file (.txt .md .pdf .html .docx .epub)
npx cadence-deslop ./a-repo          # scan an entire folder or repo, worst first
npx cadence-deslop https://a.blog/x  # a live page
pbpaste | npx cadence-deslop         # the clipboard
npx cadence-deslop --strict post.md  # exit 1 above score 25, for CI
```

---

## 4. Choosing a voice

| Voice | Reach for it when |
|---|---|
| `plain` | Docs, UI copy, anything utilitarian. Say it once, plainly. |
| `punchy` | Landing pages, taglines, posts that need contrast and a hook. |
| `reckoning` | Persuasion: set a scene, then land a hard truth. |
| `counsel` | Reflective, advisory writing that reframes the reader's question. |
| `measured-academic` | Careful argument that concedes before it concludes. |
| `seminar` | Teaching: demystify something hard, plainly and with wit. |
| `dispatch` | Storytelling that argues: open on a scene, pile up detail, then land it. |
| `column` | Analysis: start from a fact, reason it through, hand over a usable principle. |

No voice fits? Learn your own (§3).

---

## 5. The `cadence-deslop` CLI

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
| `<dir>` | Scan a folder/repo: score every prose file, ranked worst-first. Skips `node_modules`, `dist`, `.git`, and friends. |
| `<url>` | An `http(s)://` URL is fetched live; HTML is reduced to its visible text. |
| *(stdin)* | With no file, reads text from standard input. |
| `--html` | Treat input as HTML: score the visible text, skip tags/scripts/styles. Auto for `.html`/`.htm`; use the flag for stdin. |
| `--prose-only` | Treat input as Markdown: skip fenced code, blockquotes, tables, and HTML. |
| `--json` | Output the full result as JSON instead of the human report. |
| `--strict` | Exit `1` if the score exceeds **25** (a CI gate). |
| `--max <n>` | Exit `1` if the score exceeds **n**. Overrides `--strict`. |
| `-h`, `--help` | Print usage and exit. |
| `-v`, `--version` | Print the version and exit. |

### Input formats

| Source | Handling |
|---|---|
| `.txt`, `.md` | Scored as-is. Add `--prose-only` to skip Markdown code/quotes/tables. |
| `.html`, `.htm` | Auto-stripped to visible text, then scored. |
| `.pdf` | Text extracted with built-in `zlib` (no pypdf). Subset-font PDFs fail with a clear message — convert to `.txt`. |
| `.docx` | Text pulled from the Word document (a ZIP of XML), also with built-in `zlib`. |
| `.epub` | The book's chapters (a ZIP of XHTML) pulled out and reduced to prose — ideal for learning a voice from a whole book. |
| `http(s)://…` | Fetched live; if it's HTML, reduced to visible text. The only thing that touches the network. |

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Ran (and, under `--strict`/`--max`, stayed within the limit). |
| `1` | `--strict`/`--max` threshold exceeded. |
| `3` | A `.pdf`/`.docx`/URL produced no readable text (convert it to `.txt`). |

### Examples

```bash
cadence-deslop draft.txt                 # human report
cadence-deslop ./some-repo               # scan a folder/repo, ranked worst-first
cadence-deslop report.docx               # score a Word document
cadence-deslop https://a.blog/post       # fetch a live page and score it
cadence-deslop --json draft.md           # machine-readable
cadence-deslop --prose-only README.md    # score the prose, not the code samples
cadence-deslop --max 10 README.md        # fail unless grade A
pbpaste | cadence-deslop --html          # score HTML from the clipboard
```

---

## 6. Reading the output

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

| Grade | Score | Read it as |
|---|---|---|
| A | 0 – 10 | Clean. No AI fingerprints. |
| B | 11 – 25 | Minor tells; usually fine to ship. |
| C | 26 – 45 | Noticeable slop; recast it. |
| D | 46 – 70 | Reads as machine-made; rewrite. |
| F | 71 – 100 | Heavy slop. |

**Metrics** (also in `--json` under `metrics`):

| Field | Meaning |
|---|---|
| `words`, `sentences`, `avgSentenceLength` | Basic counts. |
| `sentenceLengthCV` | Rhythm variance. Higher is more human; under ~0.4 is flat. This is the number that matters most — flat, same-length sentences are the loudest tell. |
| `uniformRhythm` | `true` when the rhythm is too even. |
| `adverbRate`, `emDashRate` | Per-100-word rates. |
| `triadDensity` | Three-item lists per sentence. |

**Finding rules:** `banned-phrase`, `hollow-confidence`, `triad`, `negation-pivot`,
`hedge-stack`, `cliche-opener`. Each finding has a `rule`, `severity`, and `snippet`.

Remember what the score *is*: the absence of AI fingerprints, not proof the writing
is good. A clean score on an empty argument is still an empty argument.

---

## 7. Gotchas

- **Don't over-recast good prose.** If a draft already scores under ~15 and you only
  wanted a light voice shift, say so — a heavy rewrite can flatten what worked.
- **The meaning wins, always.** If a smoother sentence would drop a fact, keep it.
- **The score is a tool, not a trophy.** Chase clarity and a real point; let the low
  score be a side effect.
- **One voice per profile.** Learning from two mixed authors gives a muddy voice.

---

## 8. The `extract-text` helper & npm scripts

`/cadence learn` uses `extract-text.mjs` to pull prose from a file or URL. Run it
directly if you like:

```bash
node skills/cadence/scripts/extract-text.mjs <file.pdf|.txt|.md|.html|.docx|.epub | url>   # prose to stdout
```

From a clone, the npm scripts:

| Script | Does |
|---|---|
| `npm test` | Run the test suite (detector + extractors). |
| `npm run deslop -- <file>` | Run the detector locally. |
| `npm run check:docs` | Score the repo's own docs; fail if any drops below grade A. |
