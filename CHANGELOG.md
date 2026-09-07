# Changelog

All notable changes to Cadence are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/).

The **`cadence` Claude Code plugin** and **`cadence-deslop` npm package** share a
version. Starting with 0.3.0, the bundled Codex skill and browser/editor integration
manifests use that version too. A version bump here does not publish to a store.
Because detector rules affect scores, any release that changes a rule says so here.

## [Unreleased]

## [0.3.0] — prepared, not yet released

### Added

- **An installable Codex skill** (#18). Run `npm run install:codex` from a checkout
  for a user-wide install, or add `-- --project <path>` for one repository. It
  bundles the existing Codex rules with the detector and seed profiles. Rewrites
  measure the original and result, report the tells, and preserve document markup.
  No project `AGENTS.md` or Codex settings are overwritten. The npm package now
  includes the `cadence-install-codex` command.
- **Shared agent-skill installation** for Kimi Code CLI, ZCode Agent, standalone
  Claude Code, and OpenCode. `cadence-install-skill --agent <host>` bundles one
  workflow and the existing detector, without setting a model or provider.
  Kimi honors `KIMI_CODE_HOME`. ZCode installs user-wide; project scope uses its
  documented import UI. Existing Codex commands remain compatible.
- **Website install cards** for the five agent hosts, with copyable source
  commands and links to setup guides. The site separates source availability from
  npm publication, explains model/provider boundaries, and checks demo scores
  against the detector in tests.
- **Scoring documentation and diagnostics** (#9, #11). `SCORING.md` records the
  weights and formulas. `analyze()` returns the exact lexical and structural
  contributions; `breakdown.total` is the raw total before the score's 0–100 cap.
  The benchmark reports score distributions and sample-level rule rates.
- **Evaluation and security guidance** (#12, #14, #15). The regression corpus is
  not a held-out evaluation. External datasets still need review before use.
- **Kaggle notebook workflow** (#17). Dry, smoke, and training modes share a
  generated notebook and output archive. GPU training remains experimental;
  a sample-data run is not evidence of learned-model performance.
- **Release checks** for shared versions and an install from the npm tarball.

- **An accuracy benchmark** (`benchmark/`) — a 48-sample labeled corpus (human
  writing including public-domain classics, AI across many registers) and `npm run
  bench` that measure how well the score separates the two. It reports Wilson
  confidence intervals, not bare point estimates. The honest read: precision-first,
  about 91% precision with high specificity, and recall as the weak spot near 42%
  because the detector misses AI that avoids the common tells. `npm run bench:check`
  gates CI against regression, and the report prints the full sweep across cutoffs.
- **A shareable result on the score page.** Any result on `check.html` now has a
  copy-link button that encodes the grade plus its top tells into the URL (never
  the text itself), opening to a read-only card. A second button saves the card
  as a PNG. Both run in the browser, so nothing is sent.
- **A tenth voice, `essence`** — first-principles tech-blog writing: strip a
  domain down to its physical or economic laws, reason up from there, and land on a
  conviction plain enough to act on. Learned from venture-firm tech essays.
- **A VS Code extension** (`integrations/vscode/`) — score prose for AI tone in the
  editor: a live grade in the status bar, the AI tells squiggled inline, and a
  score-on-demand report for the document or a selection. The detector is generated
  from the same `deslop.mjs` as the CLI and Chrome extension, so the surfaces can't
  drift (a test enforces it). Build with `npm run build:vscode`.

### Changed

- **Unicode ellipses now end sentences** (#10), which can change rhythm metrics
  and scores for passages that contain them. Existing grade boundaries are unchanged.
- **Inputs over 5 MiB are rejected** (#13). Files are checked before reading and
  stdin while reading. Scans fail rather than skipping oversized prose. Extracted
  text and URL text are checked before analysis, not during decompression/download.
  The CLI reports the limit with exit code 2; UI surfaces clear stale results.
- **Integration manifests align at 0.3.0.** Chrome and Gemini previously had
  their own 0.1.0 manifest versions. This aligns the source bundles; store
  publication is still a separate step.

- **Negation-pivot detection now catches contraction forms** of the rhetorical
  seesaw, which the rule previously missed, and weighs a pivot more heavily
  because it almost never shows up in human writing. Copy built on that pattern
  now scores a few points higher.

### Fixed

- **The seed voice count** in the Codex/Claude command documentation (#16).
- **Oversized-input errors** no longer leave prior grades or share results in
  browser/editor views. VS Code hides its status item when the setting is disabled.
- **Score-breakdown documentation** now distinguishes raw totals from capped scores.
- **The Claude chat bundle** now includes license and version metadata, so its
  detector reports the release version rather than the `0.0.0` fallback.

## [0.2.0] — 2026-06-20

Cadence goes multi-surface: the same writing skill now runs in Claude Code,
a regular Claude conversation, Codex, Gemini CLI, and DeepSeek, alongside the
Chrome extension and the `npx` detector. A ninth voice ships, and a bare
`/cadence` now guides you to the right command.

### Added

- **Guided `/cadence`.** Invoked with no command, it now shows a menu that routes
  you by intent; when a command needs a voice and you haven't named one, it lists
  all nine and lets you pick.
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
- **A ninth voice, `kin`** — a parent's unsparing letter to a child, every truth
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

[0.3.0]: https://github.com/wuisabel-gif/Cadence/compare/v0.2.0...main
[0.2.0]: https://github.com/wuisabel-gif/Cadence/releases/tag/v0.2.0
[0.1.0]: https://github.com/wuisabel-gif/Cadence/releases/tag/v0.1.0
