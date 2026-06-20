# Installing & Activating Cadence

There are two ways to use Cadence, and they install differently:

- **The full plugin** — the `/cadence` skill (write, recast, learn, deslop, voices).
  Runs inside **Claude Code**.
- **The detector only** — `cadence-deslop`, the scorer on its own. Runs anywhere
  with Node, no Claude Code needed.

---

## Read this first: where the plugin runs

The `/cadence` plugin only loads in **Claude Code**. That is:

- the **`claude` command** in a terminal, or
- the **Claude Code extension** in VS Code / JetBrains, or
- the **Claude Code mode** of the Claude desktop app (the session where Claude can
  run commands and edit files).

It does **not** load in:

- the **claude.ai website** chat,
- the **regular chat** in the Claude desktop app (the plain conversation view).

If you type `/cadence` and Claude says it doesn't recognize the command, you are
almost always in a regular chat, not Claude Code. That is the single most common
reason activation "fails." Switch to a Claude Code session and try again.

---

## Install the plugin

**Interactive (in a Claude Code session):**

```
/plugin marketplace add wuisabel-gif/Cadence
/plugin install cadence@cadence
```

Both steps matter. `marketplace add` only makes Cadence *available*; `install` is
what turns it on. Start a new session afterward.

**Non-interactive (edit settings directly):** add the plugin to
`~/.claude/settings.json`. The value is an **object**, not an array:

```json
{
  "extraKnownMarketplaces": {
    "cadence": { "source": { "source": "git", "url": "https://github.com/wuisabel-gif/Cadence.git" } }
  },
  "enabledPlugins": {
    "cadence@cadence": true
  }
}
```

Then start a fresh Claude Code session (or run `/reload-plugins` in an active one).

---

## Verify it worked

In a Claude Code session:

```
/cadence voices
```

You should see eight voices: counsel, reckoning, measured-academic, plain, punchy,
seminar, dispatch, column. You can also run `/plugin` and confirm **cadence** shows
as enabled. Once it loads, you can skip the slash command and just ask — *"score
this draft,"* *"recast this in the column voice."*

---

## If it still won't activate

| Symptom | Cause | Fix |
|---|---|---|
| `/cadence` not recognized; Claude talks about your project files instead | You're in a regular chat, not Claude Code | Open a Claude Code session (terminal `claude`, the IDE extension, or the desktop app's Code mode) |
| Added the marketplace but nothing happens | The plugin was never installed — only the marketplace was added | Run `/plugin install cadence@cadence`, or add `enabledPlugins` as above |
| `enabledPlugins` rejected by settings validation | It was written as an array | It must be an object: `{ "cadence@cadence": true }` |
| Plugin enabled but the skill doesn't appear | Skills load at startup | Start a new session, or run `/reload-plugins` |
| `/cadence` loads but voices or the detector aren't found | A same-named personal skill at `~/.claude/skills/cadence` is shadowing the plugin | Remove it: `rm ~/.claude/skills/cadence`, then restart |
| `claude: command not found` in your terminal | The CLI isn't installed | `npm install -g @anthropic-ai/claude-code`, then run `claude` |

---

## Just the detector (no Claude Code)

If you only want to score prose, the detector ships on its own and needs nothing
but Node:

```bash
npx cadence-deslop draft.txt        # score a file (.txt .md .pdf .html .docx)
npx cadence-deslop ./a-repo         # scan a whole folder, ranked worst-first
npx cadence-deslop https://a.blog/x # score a live page
```

See [MANUAL.md](MANUAL.md) for every flag and [SOP.md](SOP.md) for the day-to-day
workflow.
