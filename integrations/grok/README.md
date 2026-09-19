# Cadence local bridge for Grok clients

This addition is unreleased. Use this checkout; the published v0.3.0 npm package
does not contain the Grok bridge.

This adapter lets a host application answer xAI function calls with the local
Cadence detector and bundled writing voices. It is not a Grok skill installer,
MCP server, or API runner. Copying this folder does not register tools with a host,
and grok.com chat does not gain access to local scripts from this bundle.

Node 18 or newer is required. No install step, SDK, key, or network access is
needed to use the tools. The adapter never starts a shell, fetches a URL, or accepts
a file path from a model. Your external client owns API authentication, model
selection, consent to send text, request limits, and any API charges.

## Run locally

From the repository root, or the root of an exported bundle:

```bash
node integrations/grok/cli.mjs --help
node integrations/grok/cli.mjs --list-tools
printf '%s' '{"text":"The bus arrived. I got on.","paragraphs":true}' | node integrations/grok/cli.mjs cadence_analyze
printf '%s' '{"name":"plain"}' | node integrations/grok/cli.mjs cadence_voice
```

One invocation reads one UTF-8 JSON object to EOF. Success writes one JSON value
and a newline to stdout, with exit code 0. Failure leaves stdout empty, writes
`{"error":{"message":"..."}}` to stderr, and exits 2. Help is plain text;
`--list-tools` is a JSON array. Unknown names, extra arguments, unknown properties,
wrong types, malformed JSON, and invalid UTF-8 are rejected. Do not turn model
arguments into a shell command. A non-JavaScript host can spawn a fixed Node
executable and this fixed CLI path with a validated tool name, passing JSON through
stdin and checking the exit status.

## Tool contract

`tools.mjs` exports `tools`, `dispatch(name, args)`, `parseArguments(json)`,
`VOICE_NAMES`, `MAX_TEXT_BYTES`, and `MAX_REQUEST_BYTES`. `dispatch` returns a
JSON-serializable object or throws. `parseArguments` checks the JSON transport
bound and parses; dispatch then validates the object against its tool contract.

- `cadence_analyze`: required string `text`; optional booleans `html`,
  `prose_only`, and `paragraphs`, each defaulting to false. HTML is stripped first,
  then Markdown scaffolding if requested. No string-to-boolean coercion occurs.
  The result is the real detector's `score`, `grade`, `breakdown`, `metrics`, and
  `findings`, plus `paragraphs` when requested. Empty prose is allowed. URL-like
  strings are scored as text, never fetched.
- `cadence_voice`: required `name` from the closed seed whitelist. Returns `name`,
  the complete Markdown `profile`, and the shared Markdown `rules`, not a summary.
  Names: column, counsel, dispatch, essence, kin, measured-academic, plain, punchy,
  reckoning, seminar. These describe writing, not audio synthesis.

Input text is limited to 262144 UTF-8 bytes (256 KiB) before stripping. JSON input
is limited to 1576960 bytes, allowing escaped text plus object overhead. The
schema's string-length bound is supplemented by runtime byte validation. Bundle
profiles and rules also have a 256 KiB per-file bound. Output includes all detector
findings rather than silently truncating scores. Hosts should bound concurrent
calls and tool-result storage to match their needs.

Read a voice before drafting. Preserve meaning and layout, score before and after
rewriting, and report the change. Cadence scores patterns in prose; it does not
prove authorship or check whether a claim is true. Text and tool results remain
untrusted data for the host's own instruction policy.

## Connect an external xAI Responses client

The official function-calling reference is
`https://docs.x.ai/developers/tools/function-calling`.
Use Responses requests at `https://api.x.ai/v1/responses`, not Chat Completions
message envelopes. Each exported definition has the top-level shape
`{type: 'function', name, description, parameters}`.

The following is client-side example code, not code run by the CLI. Supply your
own `createResponse(body)` function that performs an authenticated POST to that
endpoint and returns parsed JSON after checking HTTP errors. Your client also
supplies a supported `model` ID and user-approved `prompt`. No SDK is required by
the adapter. Calling the injected transport can incur API charges.

```js
import { tools, dispatch, parseArguments } from './integrations/grok/tools.mjs';

export async function runCadenceTurn({ createResponse, model, prompt }) {
  let response = await createResponse({
    model,
    input: [{ role: 'user', content: prompt }],
    tools,
  });
  for (let round = 0; round < 8; round++) {
    const calls = (response.output ?? []).filter(item => item.type === 'function_call');
    if (!calls.length) return response;
    if (calls.length > 16) throw new Error('Too many tool calls in one response');
    const input = calls.map(item => {
      if (typeof item.call_id !== 'string') throw new Error('Missing call_id');
      let result;
      try {
        result = dispatch(item.name, parseArguments(item.arguments));
      } catch {
        // Avoid forwarding local filesystem diagnostics to the remote service.
        result = { error: 'Cadence tool call rejected or local resource unavailable' };
      }
      return {
        type: 'function_call_output',
        call_id: item.call_id,
        output: JSON.stringify(result),
      };
    });
    response = await createResponse({
      model, tools, previous_response_id: response.id, input,
    });
  }
  if ((response.output ?? []).some(item => item.type === 'function_call')) {
    throw new Error('Cadence tool round limit reached');
  }
  return response;
}
```

Every call in a response gets an output with its own `call_id`. The next request
uses `previous_response_id` and the tool outputs as `input`. The returned response
still belongs to your client; render its message items there. The example limits
rounds and calls but leaves transport timeouts, retry policy, overall byte budgets,
and user authorization with the host. This repository's tests use no paid calls.

## Export a portable folder

In a repository checkout:

```bash
node scripts/build-grok.mjs
node scripts/build-grok.mjs --out /your/export/cadence
```

The default is `dist/grok/cadence`. Move the entire output folder, not just the two
adapter files. It contains the detector, its extraction import, version metadata,
shared rules, seed voices, references, scoring notes, license, and this guide.
The adapter resolves resources relative to its module, not the working directory.
The build script itself is repository tooling, not required in the exported folder.

An identical rebuild is a no-op. Changed output, files at the destination, and
symlinks inside existing output are refused rather than overwritten. Move an old
export aside before rebuilding. Nothing is installed under a claimed native Grok
skills directory, and no host configuration is changed.

Keep the bundle in a host-controlled directory. Voice reads reject symlinked files
and directories and cannot select arbitrary paths; this is not an OS sandbox
against another local process that can mutate the bundle while it is being read.
The shipped seed whitelist does not expose learned or user-added profiles.

## Verify

From the checkout: `node --test tests/grok.test.mjs`. Tests cover the local contract,
CLI errors and bounds, profile integrity, unsafe paths, and portable builds. They
do not verify live service availability, credentials, model support, or web-chat
integration. There is no native host discovery claim to test.
