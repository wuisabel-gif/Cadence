# Cadence for Gemini CLI

A [Gemini CLI](https://github.com/google-gemini/gemini-cli) extension that teaches the
agent to write in a voice and strip AI tone, plus the deterministic de-slop detector
(which runs anywhere via `npx`, no install).

## Install

Gemini reads extensions from `~/.gemini/extensions/<name>/` (global) or
`<project>/.gemini/extensions/<name>/` (per project). Link this folder in:

```bash
# global, for every project
mkdir -p ~/.gemini/extensions
ln -s "$(pwd)/integrations/gemini" ~/.gemini/extensions/cadence
```

Or copy it instead of symlinking if you'd rather pin a version:

```bash
cp -R integrations/gemini ~/.gemini/extensions/cadence
```

Start a new Gemini CLI session and the `GEMINI.md` context loads automatically. Confirm
with `/extensions list`.

## Use

Ask in plain language — the context tells the agent what to do:

- *"Score this draft for AI tone."* → it runs `npx cadence-deslop` and reads back the score and tells.
- *"Rewrite this in the punchy voice."* → it recasts your text, keeping the meaning.
- *"Write a launch paragraph in the reckoning voice."* → it drafts in that voice.

The detector works on its own in any shell, no extension needed:

```bash
npx cadence-deslop draft.txt
```

## What it is

`gemini-extension.json` points Gemini at `GEMINI.md`, which carries the same writing
laws and voices as the Claude Code (`SKILL.md`) and Codex (`AGENTS.md`) versions. One
detector, the same guidance, three agents.
