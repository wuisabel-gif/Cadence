# Cadence across coding agents

Cadence installs into an **agent host**, not into model weights. Use the same skill
with Kimi K3, GLM-5.3, or another model your host supports. Cadence does not select
models, connect accounts, or store API keys. Set up your provider separately.

All targets ship the same `SKILL.md`, shared writing rules, detector, and voice
profiles. Only discovery paths and optional host metadata differ. The original
Codex commands remain available.

## Install from this checkout

Choose the host you use. Each command installs for the current user:

```bash
npm run install:kimi
npm run install:zcode
npm run install:claude
npm run install:opencode
# Existing Codex entry point:
npm run install:codex
```

Or use the common installer:

```bash
npm run install:agent -- --list
npm run install:agent -- --agent kimi
npm run install:agent -- --agent opencode --project /path/to/project
```

Node 18 or newer is required to run the bundled detector. Restart the CLI session
after installation; in ZCode, refresh the Skills settings page and enable Cadence.
No installation command changes provider settings or project instructions.

## Paths and invocation

| Target | User-wide directory | Project directory | Invoke |
| --- | --- | --- | --- |
| `codex` | `~/.agents/skills/cadence` | `.agents/skills/cadence` | `$cadence` or a natural request |
| `kimi` | `~/.kimi-code/skills/cadence` | `.kimi-code/skills/cadence` | `/skill:cadence` or a natural request |
| `zcode` | `~/.zcode/skills/cadence` | Use ZCode's project import UI | `$cadence` |
| `claude-code` | `~/.claude/skills/cadence` | `.claude/skills/cadence` | `/cadence` or a natural request |
| `opencode` | `~/.config/opencode/skills/cadence` | `.opencode/skills/cadence` | Ask it to load the `cadence` skill |

Kimi honors `KIMI_CODE_HOME`; the user skill goes into its `skills/cadence`
subdirectory. This targets the current Kimi Code CLI, not the older Python
`kimi-cli` layout. Other custom configuration roots can use an explicit `--dest`
path; check the host's discovery settings rather than assuming it will scan any
folder. The installer does not infer a ZCode project path.

Some hosts also discover compatibility directories such as `.agents/skills`.
Check the selected skill's source if you have several Cadence installations. A
working shared install may already be enough; keep only the copies you need.

## Workflow

```text
Use Cadence to recast README.md in the essence voice.
Use Cadence to de-slop this documentation and report the before/after scores.
Use Cadence to score this file without editing it.
```

The agent loads the requested voice, scores the original, edits only the prose,
and scores again with the same flags. The report names the remaining tells and
checks whether the user's score target passed. A project `voices/<name>.md`
overrides the shipped profile of the same name. Low scores alone do not prove
quality or preserved meaning.

The detector runs locally with no runtime dependencies or model API calls. The
host still uses its configured model service for writing. File/shell permission
must be available; a skill cannot bypass a denied tool call. Plain web chats
without local execution are not covered by this installer.

## npm and portable builds

These npm commands require the expanded v0.3.0 package to be published. Until
then, use the checkout commands above:

```bash
npx --package=cadence-deslop@0.3.0 cadence-install-skill --agent kimi
npx --package=cadence-deslop@0.3.0 cadence-install-skill --agent zcode
npx --package=cadence-deslop@0.3.0 cadence-install-skill --agent claude-code
npx --package=cadence-deslop@0.3.0 cadence-install-skill --agent opencode
```

Build a portable directory without installing into your home:

```bash
npm run build:agent -- --agent kimi
# Or choose a fresh output directory:
npm run build:agent -- --agent zcode --out /path/to/new/cadence
```

Output defaults to `dist/<host>/cadence`. The folder includes the shared rules,
all seed voices, and `skills/cadence/scripts/deslop.mjs`. Existing modified
installs or builds are never overwritten. Identical repeats are a no-op. Back up
an old installation outside every skills discovery tree before upgrading.

## Adding a host

Add a target to `scripts/skill-targets.mjs` with paths verified from its official
documentation. Add directory/discovery tests and its setup guide. Reuse
`integrations/agents/SKILL.md` and `scripts/agent-bundle.mjs`; do not fork the
writing workflow for each model generation. A model change within an existing
host normally needs no Cadence changes.

## Host guides and sources

- [Kimi Code CLI](../kimi/README.md) — [official skills format and locations](https://moonshotai.github.io/kimi-code/en/customization/skills.html)
- [ZCode](../zcode/README.md) — [official skills management](https://zcode.z.ai/en/docs/skill)
- [Claude Code](../claude-code/README.md) — [official skill locations](https://code.claude.com/docs/en/skills)
- [OpenCode](../opencode/README.md) — [official Agent Skills documentation](https://opencode.ai/docs/skills/)
- [Codex](../codex/README.md) — its existing installer remains compatible.

Locations were checked against those sources on September 7, 2026. Filesystem
and package tests do not prove model-generated rewrite quality; verify that
separately in the client you use.
