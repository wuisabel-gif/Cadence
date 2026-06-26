# Cadence — VS Code extension

Score prose for AI tone without leaving the editor. The detector is bundled, so it
runs entirely on your machine — no account, no network, nothing leaves the file.

- **Live grade in the status bar.** Open a Markdown, plain-text, or commit-message
  file and the grade (`A`–`F`) and score update as you type. Click it for the full
  report.
- **The tells, squiggled inline.** Banned phrases, hollow-confidence words, reflexive
  triads, negation pivots, and cliché openers are marked where they sit.
- **Score on demand.** Run **Cadence: Score document for AI tone** from the Command
  Palette, or select text, right-click, and choose **Cadence: Score selection** —
  the report lists the metrics (including the rhythm-variance `CV`, the strongest
  tell) and every named finding.

## Try it now (run from source)

1. From the repo root, build the bundled detector: `npm run build:vscode`
2. Open this `integrations/vscode/` folder in VS Code.
3. Press **F5** (Run → Start Debugging) to launch an Extension Development Host.
4. In that window, open any `.md` file — watch the status-bar grade and the inline
   squiggles. Or open the Command Palette and run **Cadence: Score document**.

## Install it for everyday use

Package it into a `.vsix` and install that:

```sh
npm run build:vscode                 # from the repo root, first
cd integrations/vscode
npx @vscode/vsce package             # produces cadence-deslop-<version>.vsix
code --install-extension cadence-deslop-*.vsix
```

## Settings

| Setting | Default | What it does |
|---|---|---|
| `cadence.statusBar.enabled` | `true` | Show the live grade for the active editor. |
| `cadence.diagnostics.enabled` | `true` | Squiggle AI tells inline as you type. |
| `cadence.proseOnly` | `false` | Strip Markdown/HTML scaffolding (code, quotes, tables, tags) before scoring, so the grade reflects only the prose a reader sees. Diagnostics always point at real positions in the file. |
| `cadence.languages` | `markdown, mdx, plaintext, git-commit, latex, quarto, asciidoc, restructuredtext` | Which language IDs get the live grade and diagnostics. The score commands work in any file. |

## How it stays honest

`detector.js` is **generated from the same `deslop.mjs`** the CLI, the Claude Code
plugin, and the Chrome extension use, so the four can't drift. Regenerate it any
time with `npm run build:vscode`; a test fails if the generated copy and the source
ever disagree.

This is the *detector* half of Cadence. Rewriting in a chosen voice needs an LLM and
lives in the Claude Code plugin (see the main [README](../../README.md)).
