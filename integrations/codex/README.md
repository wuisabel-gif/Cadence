# Cadence for Codex

Install Cadence once, then ask Codex to recast prose in a named voice and verify
its edits. The skill bundles the detector with the shared writing rules and voice
profiles. You do not need to copy an `AGENTS.md` into each repository.

The portable source is now [integrations/agents/SKILL.md](../agents/SKILL.md),
shared with the other agent hosts. Codex retains its installer aliases and optional
`agents/openai.yaml` metadata; its discovery paths are unchanged.

## Install from a checkout

Use Node 18 or newer and a Codex version with Agent Skills support. From Cadence's
repository root:

```bash
npm run install:codex
```

This writes a self-contained skill to `~/.agents/skills/cadence/`. It does not
change your Codex configuration or project instructions. Start a new Codex session
after installation. Use `/skills` or type `$cadence` to select it explicitly.

For a project-local install instead:

```bash
npm run install:codex -- --project /path/to/project
```

That writes `<project>/.agents/skills/cadence/`. Choose one scope; you do not need
both. When a path has spaces, quote it.

## Install from npm

The installer is included in the v0.3.0 package. Install once with npm:

```bash
npx --package=cadence-deslop@0.3.0 cadence-install-codex
# Or install only for this project:
npx --package=cadence-deslop@0.3.0 cadence-install-codex --project .
```

The npm fetch needs network access. After installation, the bundled detector
scores local files without fetching npm packages. Codex's own model calls still
use its configured service; local scoring does not make the whole rewrite offline.

## Use it

In Codex, ask:

```text
Use Cadence to recast README.md in the essence voice.
Use Cadence to de-slop the documentation without changing code or links.
Use Cadence to rewrite this paragraph in the measured-academic voice.
$cadence list the available voices.
```

The skill reads the existing [shared rules](../../skills/cadence/AGENTS.md), loads
the chosen voice, scores the original, edits the prose, and re-scores the result.
It reports the measured score delta with the remaining tells. Facts and document
structure must survive; a lower score alone does not establish a better rewrite.

A profile in your project's `voices/<name>.md` takes precedence over a seed of the
same name. New profiles go there, not in the installed skill. A scoring-only
request does not authorize a rewrite. Codex may ask for permission to run Node
under your sandbox policy; the skill never bypasses that policy.

No `.cadence.json` parser is included in this release. State the voice and score
target in your request or repository instructions. If you require a gate, ask
Codex to run the detector with `--max <n>` and report whether it passed.

## Inspect the installation

```text
cadence/
  SKILL.md                         # discovery and execution flow
  AGENTS.md                        # copied verbatim from the shared Codex rules
  agents/openai.yaml               # picker metadata and suggested prompt
  skills/cadence/scripts/          # unchanged detector and extractors
  skills/cadence/reference/        # command references and profile schema
  voices/                         # current seed profiles, copied from source
  package.json                    # version for the bundled CLI
  SCORING.md
  LICENSE
```

To check the detector without a model call:

```bash
node "$HOME/.agents/skills/cadence/skills/cadence/scripts/deslop.mjs" --version
node "$HOME/.agents/skills/cadence/skills/cadence/scripts/deslop.mjs" --prose-only --json README.md
```

Substitute the project-local path if you chose that scope. The nested path keeps
the original CLI's version lookup working; the detector is not a separate fork.

## Build, update, or remove

```bash
npm run build:codex                         # dist/codex/cadence/
node scripts/build-codex.mjs --out /path/to/new/cadence
node scripts/install-codex.mjs --dest /path/to/skills/cadence
```

The installer and builder will not overwrite a changed or unrelated directory.
Repeating an identical install is safe. To upgrade, first move the old `cadence/`
directory to a backup **outside all skills directories**, then run the installer
again. To uninstall, move it outside the discovery tree or remove that directory
after backing up any changes. Project voices and `AGENTS.md` remain untouched.

If Codex does not discover it, confirm the install path and restart the session.
Avoid running the installer as root or into a different user's home. The raw
`integrations/codex/` source directory alone is not a full bundle; use the builder
or installer so the referenced files are present.

The install paths and optional metadata follow OpenAI's
[Codex skills documentation](https://developers.openai.com/codex/skills/).
