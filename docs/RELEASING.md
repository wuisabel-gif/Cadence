# Preparing a Cadence release

Preparation builds and checks artifacts. It does **not** publish to npm, create a
Git tag, or submit an extension to a store. Do those steps only after the release
owner approves the exact commit and artifacts.

## Versions and notes

Use the same version in these files:

| Surface | File |
| --- | --- |
| npm | `package.json` |
| Claude plugin | `.claude-plugin/plugin.json` |
| Grok Build plugin | `.grok-plugin/plugin.json` |
| Cadence marketplace entry | `.claude-plugin/marketplace.json` |
| Chrome extension | `extension/manifest.json` |
| Gemini extension | `integrations/gemini/gemini-extension.json` |
| VS Code extension | `integrations/vscode/package.json` |

Do not change the version of another project's marketplace entry. Each agent
bundle takes its version from the root package at build time. `npm run
check:release` rejects a mismatch and requires a versioned changelog section.

Keep the next version marked as prepared, not released, until publication.
Record changes that affect scores, rejected inputs, or public result fields.
Keep experimental training claims separate from tested CLI/skill behavior.

## Automated checks

From a clean checkout with Node 20 or newer, npm, and `tar`:

```bash
npm run release:check
npm run build:extension
npm run build:vscode
git diff --exit-code -- extension/detector.js integrations/vscode/detector.js
```

The release check compares versions, creates a temporary npm tarball, extracts it,
installs every agent target in an isolated home directory, and runs each bundled
detector from an unrelated working directory. It checks voices and shared rules too.
It uses no model and does not touch your installed skills.

For a machine with Codex installed, also run:

```bash
npm run check:codex
```

That starts Codex's app server with a temporary home and asks it to list skills in
a fresh project. It verifies discovery without creating a thread or making a model
request. It does not prove rewrite quality; perform the manual check below too.

With the current Kimi Code CLI installed, `npm run check:kimi` checks user and
project discovery through its session-less local catalog API. It uses temporary
configuration and an authenticated loopback server; no model call is made.
ZCode, Claude Code, OpenCode, and Grok Build still need the client checks listed below.

CI covers the automated tests on the supported minimum Node 20 as well as Node 22
and 24. The real-Codex check is separate so CI needs no Codex account or credentials.

## Build artifacts for review

```bash
npm run build:codex              # dist/codex/cadence/
npm run build:agent -- --agent kimi  # or zcode, claude-code, opencode, grok
npm pack --pack-destination dist
npm run build:claude-skill       # cadence-skill.zip; needs zip
```

Each agent build refuses to overwrite a different tree. Move any previous build
outside the output path first, or pass `--out` with a fresh directory. If making
an agent-skill ZIP for a release asset, place the built `cadence/` directory at its root.
The Chrome and VS Code build scripts generate source bundles and icons, not store
submissions or a VSIX. Follow each integration's packaging guide when publishing
those surfaces.

Never attach local `.env` files, API keys, private voices, or training pairs.
Review the npm file list. The tarball should contain the agent installers and skill
sources, but not the experimental LoRA directory, tests, or build scratch files.

## Manual sign-off

- Install the skill in a disposable user or project location, using the artifact.
- Start a fresh Codex session. Ask it to recast a Markdown fixture in `essence`.
- Repeat discovery and a small rewrite in each additional host advertised for the
  release. Refresh ZCode's Skills settings; do not infer discovery from file layout.
- Confirm it reads the profile, runs Node before and after, and reports real scores.
- Review the diff: facts, links, code, and markup must survive. Check a scoring-only
  request does not edit the file. Try a project voice override as well.
- Verify permission denial produces an honest "not measured" response.
- In the score page and editor, check normal → oversized → normal input. Stale
  scores must clear and normal scoring must recover.
- Reload the deployed score page after a service-worker update and confirm its
  assets refresh. A local VM test does not validate deployed cache behavior.

## Publish only after approval

After sign-off, record the release date and update the website's version labels
in the release commit. Merge it, then tag that exact commit:

```bash
git tag -a v0.6.0 -m v0.6.0
git push origin v0.6.0
```

The tag starts `.github/workflows/release.yml`. It checks that the tag matches
`package.json` and that `docs/releases/<tag>.md` exists, then reruns the release
check. It publishes to npm with provenance, creates the GitHub release from those
notes, and waits until the registry serves the version. No npm token or local
login is involved. The docs say "released" only from the merge until that run
finishes, usually a few minutes. If it fails before the npm step, fix the
commit, delete the tag, and tag again. npm never accepts the same version twice,
so after a publish, finish any failed later step by hand.

One-time setup: on npmjs.com, open `cadence-deslop` → Settings → Trusted
publishing. Add GitHub Actions with repository `wuisabel-gif/Cadence`, workflow
`release.yml`, and environment `npm`. To require a person to approve each
publish, add yourself as a required reviewer on the `npm` environment in the
repository settings.

Extension-store publishing is a separate action; do not claim that a manifest
version proves a store submission succeeded.

For the current candidate, see [v0.5.0 notes](releases/v0.5.0.md).
