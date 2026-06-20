# Standard Operating Procedure — Using Cadence

A working playbook for getting human-sounding prose out of Cadence. Each procedure
is a short sequence you can follow start to finish. For the full command reference,
see [MANUAL.md](MANUAL.md); for the reasoning behind it, [PHILOSOPHY.md](PHILOSOPHY.md).

The golden rule: **Cadence works on the words, not the layout or the meaning.** It
changes how something reads. It does not change what it says or how it is structured.

---

## 0. Prerequisites (once)

Install the plugin in Claude Code:

```
/plugin marketplace add wuisabel-gif/Cadence
/plugin install cadence@cadence
```

Start a new session. Confirm it took with `/cadence voices` — you should see five
voices: counsel, reckoning, measured-academic, plain, punchy, seminar, dispatch, column.

For scoring outside Claude Code, the detector runs on its own: `npx cadence-deslop`.

---

## 1. De-slop a draft (the common case)

**Use when:** you have AI-written or stiff text and want it to sound human.

1. **Diagnose first.** Ask: *"score this draft"* (`/cadence deslop`). Read what it
   flags — the score is your baseline and the findings are your to-do list.
2. **Decide whether you need a voice.** For neutral copy, the default `plain` voice
   is fine. For something with character, name one (see §6).
3. **Recast.** Ask: *"rewrite this to remove the AI tells"* (`/cadence recast`),
   naming a voice if you picked one.
4. **Read the delta.** Cadence reports `score 58 → 7` and a couple of before/after
   sentences. If the score barely moved, it paraphrased — ask it to go again and
   actually vary the rhythm.
5. **Check the meaning survived.** You own this step. A lower score with a changed
   claim is a failure, not a win.

---

## 2. Write something new in a voice

**Use when:** you're starting from a brief, not editing existing text.

1. **Have the substance first.** Know the point, the example, and the takeaway
   before you ask. Voice is delivery, not a substitute for having something to say.
2. **Pick a voice** (§6), or let it default to `plain`.
3. **Ask** with a concrete brief: *"write a 150-word product intro in the punchy
   voice."* Specify length — it keeps the draft tight.
4. **Confirm the score** it hands back (it writes, then measures). Grade A or B is
   the bar.

---

## 3. Recast a whole file (HTML, Word, Markdown)

**Use when:** the slop lives in a file — a web page, a `.docx`, a Markdown post.

1. **Point Cadence at the file:** *"de-slop landing.html in the plain voice."*
2. It **scores the file first**, then **rewrites the prose in place** — the text
   inside `<p>`, headings, list items, paragraphs. It leaves tags, classes, code
   fences, and structure untouched.
3. It **skips text meant to be slop** (a quoted bad example, a demo). If unsure, it
   asks rather than "fixing" your intentional examples.
4. It **re-scores and confirms the markup is unchanged.** Spot-check the file opens
   and renders the same; only the words should differ.

---

## 4. Learn a new voice from writing you admire

**Use when:** you want Cadence to write the way a specific author, article, or your
own past work writes.

1. **Gather a real sample** — at least ~500 words of the actual prose. A file
   (`.pdf`, `.txt`, `.md`, `.html`, `.docx`), a pasted block, or a URL all work.
2. **Ask:** *"learn a voice from this essay"* (`/cadence learn <source>`).
3. Cadence **measures the sample's real rhythm** and writes a profile to
   `voices/<name>.md` in your project.
4. **Read the profile** it shows you — the Essence and the calibration line. If it
   doesn't sound like the source, give it a longer or cleaner sample.
5. **Use it** by name in any later `write` or `recast`.

---

## 5. Score without changing anything

**Use when:** you only want a verdict — reviewing someone's copy, gating a CI build,
checking your own writing.

```bash
npx cadence-deslop draft.md          # a file (.txt .md .pdf .html .docx)
npx cadence-deslop ./a-repo          # scan an entire folder or repo, worst first
npx cadence-deslop https://a.blog/x  # a live page
pbpaste | npx cadence-deslop         # the clipboard
npx cadence-deslop --strict post.md  # exit 1 above score 25, for CI
```

Read the score, then the findings. Remember what the score *is*: the absence of AI
fingerprints, not proof the writing is good. A clean score on an empty argument is
still an empty argument.

---

## 6. Choosing a voice

| Voice | Reach for it when |
|---|---|
| `plain` | Docs, UI copy, anything utilitarian. Say it once, plainly. |
| `punchy` | Landing pages, taglines, posts that need contrast and a hook. |
| `reckoning` | Persuasion: set a scene, then land a hard truth. |
| `counsel` | Reflective, advisory writing that reframes the reader's question. |
| `measured-academic` | Careful argument that concedes before it concludes. |
| `seminar` | Teaching or explaining: demystify something hard, plainly and with wit. |
| `dispatch` | Storytelling that argues: open on a scene, pile up detail, then land the point. |
| `column` | Analysis: start from a fact, reason it through calmly, hand over a usable principle. |

No voice fits? Learn your own (§4).

---

## 7. Reading the result

| Grade | Score | Read it as |
|---|---|---|
| A | 0–10 | Clean. No AI fingerprints. |
| B | 11–25 | Minor tells; usually fine to ship. |
| C | 26–45 | Noticeable slop; recast it. |
| D–F | 46–100 | Reads as machine-made; rewrite. |

The single number that matters most under the hood is **rhythm variance** (`CV`).
Flat, same-length sentences are the loudest tell. If a recast didn't move the CV,
it didn't really change the writing.

---

## 8. Gotchas

- **Don't over-recast good prose.** If a draft already scores under ~15 and you only
  wanted a light voice shift, say so — a heavy rewrite can flatten what was working.
- **The meaning wins, always.** If a smoother sentence would drop a fact, keep the
  fact.
- **The score is a tool, not a trophy.** Chase clarity and a real point; let the low
  score be a side effect, not the goal.
- **One voice per profile.** Learning from two mixed authors gives a muddy voice.
