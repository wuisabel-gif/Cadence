# Embed Cadence on your site

Other websites can score prose with Cadence. There is no Cadence-hosted HTTP
API. You run the detector where the text already is: the visitor's browser, or
your own server.

The detector is deterministic and has no runtime dependencies. Same text, same
score. It does not rewrite. Rewriting still needs your own model.

Inputs over 5 MiB of UTF-8 are rejected. Treat posted text as untrusted. Do not
send secrets to a public page or log full drafts.

## Browser, on the visitor's machine

The hosted [score page](https://wuisabel-gif.github.io/Cadence/check.html) already
does this. Copy `extension/detector.js` from a Cadence checkout (build it with
`npm run build:extension` if you need a fresh copy) and serve it from your
origin:

```html
<script src="/detector.js"></script>
<script>
  const result = cadenceAnalyze(draft.value);
  grade.textContent = result.grade + ' · ' + result.score;
</script>
```

`cadenceAnalyze` and `cadenceAnalyzeParagraphs` are the browser names for
`analyze` and `analyzeParagraphs`. The text never leaves the device. Do not
hotlink another site's `detector.js` in production; vendor the file so a cache
or takedown cannot change your scores.

A checked example. The quoted draft below is a specimen; `--prose-only` drops
fenced samples so this page can stay grade A:

```text
In today's world, a robust solution is crucial. We must leverage synergy to unlock potential.
→ score 22  grade B  2 sentences
→ tells: banned-phrase, hollow-confidence
```

## Node, on your server

```js
import { analyze, stripHtml, stripMarkdown } from 'cadence-deslop';

export function score(text, { html = false, markdown = false } = {}) {
  let prose = String(text);
  if (html) prose = stripHtml(prose);
  if (markdown) prose = stripMarkdown(prose);
  return analyze(prose);
}
```

A tiny HTTP wrapper lives at [`examples/score-server.mjs`](../examples/score-server.mjs).
It binds to `127.0.0.1` only. Add your own login check and HTTPS before
exposing it:

```bash
node examples/score-server.mjs
curl -sS http://127.0.0.1:3847/score \
  -H 'content-type: application/json' \
  -d '{"text":"The bus arrived. I got on."}'
```

`POST /score` expects JSON `{ "text": "...", "html": false, "markdown": false }`.
Success is `200` and the detector object (`score`, `grade`, `breakdown`,
`metrics`, `findings`). Oversized or invalid JSON is `400`. Unknown routes are
`404`.

Pin `cadence-deslop@0.4.0` (or later) so scores do not drift when the detector
changes.

## What this is not

Cadence does not give you a public `api.cadence` hostname, an API key, or a
rewrite endpoint. If you stand up `/score` on your domain, you are the operator:
you hold the posted text, you set the limits, you pay for the host.

See [SCORING.md](../SCORING.md) for formulas and [SECURITY.md](../SECURITY.md)
for trust boundaries.
