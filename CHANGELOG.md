# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

Cadence ships as two things from one repo: the **`cadence` Claude Code plugin** and
the **`cadence-deslop` npm package** (the detector on its own). Their versions move
together. Because detector rules affect scores, any release that changes a rule says
so here, so a shifting number is never a surprise.

## [Unreleased]

### Added

- **More input formats.** The detector now reads `.html` (scored as visible text),
  `.docx` (parsed from the Word ZIP), `.epub` (a book's XHTML chapters), and live
  `http(s)` URLs — on top of `.txt`, `.md`, and `.pdf`. PDF extraction was also wired
  into the CLI itself.
- **Repo scan.** Point `cadence-deslop` at a directory to score every prose file
  under it, ranked worst-first, with an average and the worst offender. Skips
  `node_modules`, `dist`, `.git`, and the like.
- **`--prose-only`** (Markdown-aware scoring, skipping code/quotes/tables) and
  **`--max <n>`** (a configurable exit gate).
- **Three more voices:** `seminar` (a demystifying literature-seminar register),
  `dispatch` (narrative science-journalism), and `column` (a calm analytical essay).
- **A ninth voice, `dear`** — a parent's unsparing letter to a child, every truth
  anchored in the body, landing on a short imperative. Learned from an epistolary
  memoir register.
- **A Chrome extension** (`extension/`) — score any text for AI tone right in the
  browser, by popup or right-click. The detector runs locally and is generated from
  the same `deslop.mjs` so it can't drift (a test enforces it).
- **Codex support.** The skill now ships an `AGENTS.md` beside `SKILL.md`, so the same
  folder drives Codex as well as Claude Code. The detector is already portable —
  `npx cadence-deslop` runs in any shell — and the `AGENTS.md` carries the writing laws
  and voices a Codex agent needs to recast and write.
- **Gemini CLI extension.** An installable extension under `integrations/gemini/`
  (`gemini-extension.json` + `GEMINI.md`). Symlink it into `~/.gemini/extensions/` and
  the voices and writing laws load every session; the detector runs via `npx` as usual.
- **DeepSeek skill** under `integrations/deepseek/` — a markdown Skill for DeepSeek's
  drawer, with the writing laws and voices. The detector runs via `npx` in a terminal.
- **`npm run build:claude-skill`.** Packages a self-contained `cadence-skill.zip`
  (SKILL.md + scripts + voices, paths rewritten) for upload to claude.ai's Skills panel
  — so Cadence works in a regular Claude conversation, not just Claude Code.
- **Docs:** a consolidated MANUAL (install, workflows, full reference), a repo-scan
  tutorial, and CI that re-scores the project's
  own docs on every push and fails if any drops below grade A.

## [0.1.0] — 2026-06-19

First public release.

### Added

- **The `/cadence` skill**, with five commands: `write` (draft in a chosen voice),
  `learn` (extract a reusable voice profile from a sample), `recast` (rewrite
  existing text into a voice while keeping its meaning), `deslop` (score text and
  name every AI tell), and `voices` (list what's available).
- **The de-slop detector** (`deslop.mjs`) — deterministic, pure Node, zero
  dependencies. It scores prose from 0 to 100 and flags uniform sentence rhythm (the
  strongest tell), hollow-confidence words, reflexive triads, negation pivots, hedge
  stacking, cliché openers, and adverb and em-dash rates. Same text, same score,
  every time.
- **Five seed voices**: `counsel`, `reckoning`, `measured-academic`, `plain`, and
  `punchy`. Each is a portable markdown profile you can read, edit, and share.
- **Pure-Node PDF extraction** for `learn`, built on the standard-library `zlib`
  alone — no `pypdf`, no native deps. A readability guard fails gracefully on PDFs
  that use custom-encoded subset fonts instead of emitting garbage.
- **The `cadence-deslop` CLI**: `npx cadence-deslop draft.txt`. Reads files or stdin
  and supports `--json`, `--strict` (a CI gate that exits non-zero above 25),
  `--help`, and `--version`.
- **Plugin packaging**: the repo doubles as its own Claude Code marketplace.
- **A project site**, the rhythm-bars logo, and the README, CONTRIBUTING, and
  PHILOSOPHY documents.
- **21 tests** over the detector and the PDF extractor.

### Notes

- The score measures AI *fingerprints*, not quality. A clean score means no tells,
  not a good argument.
- The detector is English-only for now (its function-word and phrase lists are
  English).

[0.1.0]: https://github.com/wuisabel-gif/Cadence/releases/tag/v0.1.0
