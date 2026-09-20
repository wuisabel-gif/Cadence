# Cadence on Grok Bot

Grok Bot has no documented skill directory. Cadence cannot install into the
Grok Bot app or its marketplace from this repository. Put the detector on the
shared computer, score a real file, then save a private skill in the app.

You need the Grok Bot desktop app and a plan that includes it.

## 1. Put Cadence on the computer

Clone into `/workspace` so the files survive ordinary computer updates:

```bash
git clone https://github.com/wuisabel-gif/Cadence.git /workspace/Cadence
```

Or pack on another machine and copy the folder:

```bash
npm run grok-bot:pack
```

The default output is `dist/grok-bot/cadence`. Keep that copy at
`/workspace/Cadence`. Treat extra packages you install by hand as replaceable.

## 2. Prove Node and git on that computer

From a clone:

```bash
node scripts/grok-bot-setup.mjs --probe
```

Need Node 18 or newer to score. git is required only to clone. The probe prints
JSON for the machine that ran it. Tests here run that probe in CI, not on a
Grok Bot VM.

## 3. Score a real file

```bash
node /workspace/Cadence/skills/cadence/scripts/deslop.mjs --prose-only --json /workspace/Cadence/README.md
```

From a clone you can also run:

```bash
node scripts/grok-bot-setup.mjs --score README.md
```

If Node is missing, stop. Do not invent a score.

## 4. Save a private skill

After a successful pass, send the text in `SAVE_SKILL.md`, or this message:

```text
Save the process we just used as a skill called Cadence.
Read /workspace/Cadence voices and AGENTS.md first.
Score with node /workspace/Cadence/skills/cadence/scripts/deslop.mjs before and after edits.
Preserve facts and markup. Never invent a score.
```

Type `/` and confirm Cadence is listed. If it is missing, open Marketplace →
Your plugins → Manage plugins and skills → Private skills.

A Bot template can copy that private skill to another account. It does not copy
your computer or the cloned files.

## Marketplace

The Grok Bot marketplace is an in-app catalog. There is no public submission
format in Cadence, and Cadence is not listed there.

`.grok-plugin/plugin.json` is for **Grok Build**. Listing it in xAI's plugin
marketplace is a separate PR after a reachable commit.

For the filesystem skill, see [Grok Build](../grok/README.md). Official Bot
skill docs: [Skills and routines](https://docs.x.ai/grok-bot/skills-routines-and-automations).
