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
| Cadence marketplace entry | `.claude-plugin/marketplace.json` |
| Chrome extension | `extension/manifest.json` |
| Gemini extension | `integrations/gemini/gemini-extension.json` |
| VS Code extension | `integrations/vscode/package.json` |

Do not change the version of another project's marketplace entry. The Codex
bundle takes its version from the root package at build time. `npm run
check:release` rejects a mismatch and requires a versioned changelog section.

Keep the next version marked as prepared, not released, until publication.
Record changes that affect scores, rejected inputs, or public result fields.
Keep experimental training claims separate from tested CLI/skill behavior.

## Automated checks

From a clean checkout with Node 18 or newer, npm, and `tar`:

```bash
npm run release:check
npm run build:extension
npm run build:vscode
git diff --exit-code -- extension/detector.js integrations/vscode/detector.js
```

The release check compares versions, creates a temporary npm tarball, extracts it,
installs Cadence in an isolated home directory, and runs the bundled detector from
an unrelated working directory. It checks the voice files and shared rules too.
It uses no model and does not touch your installed skills.

For a machine with Codex installed, also run:

```bash
npm run check:codex
```

That starts Codex's app server with a temporary home and asks it to list skills in
a fresh project. It verifies discovery without creating a thread or making a model
request. It does not prove rewrite quality; perform the manual check below too.

CI covers the automated tests on the supported minimum Node 18 as well as Node 20
and 22. The real-Codex check is separate so CI needs no Codex account or credentials.

## Build artifacts for review

```bash
npm run build:codex              # dist/codex/cadence/
npm pack --pack-destination dist
npm run build:claude-skill       # cadence-skill.zip; needs zip
```

The Codex build refuses to overwrite a different tree. Move any previous build
outside the output path first, or pass `--out` with a fresh directory. If making
a Codex ZIP for a release asset, place the built `cadence/` directory at its root.
The Chrome and VS Code build scripts generate source bundles and icons, not store
submissions or a VSIX. Follow each integration's packaging guide when publishing
those surfaces.

Never attach local `.env` files, API keys, private voices, or training pairs.
Review the npm file list. The tarball should contain the Codex installer and skill
sources, but not the experimental LoRA directory, tests, or build scratch files.

## Manual sign-off

- Install the skill in a disposable user or project location, using the artifact.
- Start a fresh Codex session. Ask it to recast a Markdown fixture in `essence`.
- Confirm it reads the profile, runs Node before and after, and reports real scores.
- Review the diff: facts, links, code, and markup must survive. Check a scoring-only
  request does not edit the file. Try a project voice override as well.
- Verify permission denial produces an honest "not measured" response.
- In the score page and editor, check normal → oversized → normal input. Stale
  scores must clear and normal scoring must recover.
- Reload the deployed score page after a service-worker update and confirm its
  assets refresh. A local VM test does not validate deployed cache behavior.

## Publish only after approval

After sign-off, record the release date, replace pending wording in the docs, and
update the website's version labels. Tag the approved commit and publish the
reviewed tarball through the usual authenticated npm flow. Create the GitHub
release with its notes and selected artifacts. Verify registry and installation
results afterward. Extension-store publishing is a separate action; do not claim
that a manifest version proves a store submission succeeded.

For the current candidate, see [v0.3.0 notes](releases/v0.3.0.md).
