# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security vulnerability. Use GitHub's
**Report a vulnerability** button on the [Security](https://github.com/wuisabel-gif/Cadence/security) tab to send a private report to the maintainers.

Include:

- A short description and impact
- The affected component and version or commit
- Reproduction steps or a minimal proof of concept
- Any relevant logs, screenshots, or suggested mitigation

If private reporting is unavailable, contact the repository owner through the
private contact channel listed on the GitHub profile and mention Cadence in the
subject. Do not include sensitive keys or private user content in a report.

## Scope and trust boundaries

Cadence has several distinct surfaces:

- **Core detector:** `skills/cadence/scripts/deslop.mjs` performs deterministic,
  local analysis. It does not make network requests as part of scoring.
- **Local file and document extraction:** the CLI can read files and extract text
  from PDF, DOCX, and EPUB inputs. Treat untrusted documents as untrusted input.
- **URL mode:** a URL supplied to the CLI is fetched intentionally. Do not use URL
  mode for confidential material, and review redirects and fetched content before
  trusting the output.
- **Chrome extension:** the extension can read selected page text and stores its
  configured API key and voice profile in Chrome local storage. The key is sent
  directly to Anthropic only when a drafting or voice-learning action requests it.
  It is not a substitute for a managed secrets store. Remove the key when no
  longer needed.

The extension requests only the permissions declared in `extension/manifest.json`,
including local storage, context menus, and access to `https://api.anthropic.com/*`.
Review extension permissions before installing or distributing a build.

## Supported versions

Security fixes target the latest commit on `main` and the latest published
`cadence-deslop` version. Older versions may not receive fixes. Keep Node.js and
Chrome/VS Code current when running integrations.

## Privacy guidance

Do not paste secrets, credentials, or private third-party content into an issue,
benchmark fixture, voice profile, or public pull request. The core detector is
local; network behavior is limited to explicit URL fetching and the extension's
direct Anthropic requests.
