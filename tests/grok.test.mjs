import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, renameSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tools, dispatch, parseArguments, VOICE_NAMES, MAX_TEXT_BYTES, MAX_REQUEST_BYTES } from '../integrations/grok/tools.mjs';
import { analyze, analyzeParagraphs, stripHtml, stripMarkdown } from '../skills/cadence/scripts/deslop.mjs';
import { ROOT, writeGrokBundle } from '../scripts/agent-bundle.mjs';

const cli = join(ROOT, 'integrations/grok/cli.mjs');
const text = 'In today’s world, a robust solution is crucial.\n\nThe bus stopped. I got off.';
const run = (args, input = '', script = cli, cwd = tmpdir()) => spawnSync(process.execPath, [script, ...args], {
  input, cwd, encoding: 'utf8', timeout: 10000, maxBuffer: 8 * 1024 * 1024,
});
const temp = () => mkdtempSync(join(tmpdir(), 'cadence-grok-'));
function rejectsCLI(args, input) {
  const result = run(args, input);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(typeof JSON.parse(result.stderr).error.message, 'string');
}

test('Responses schemas have top-level names, closed properties and actual seed whitelist', () => {
  assert.deepEqual(tools.map(t => t.name), ['cadence_analyze', 'cadence_voice']);
  for (const tool of tools) {
    assert.equal(tool.type, 'function');
    assert.equal(tool.function, undefined);
    assert.equal(tool.parameters.type, 'object');
    assert.equal(tool.parameters.additionalProperties, false);
    assert.ok(tool.description.length);
    assert.ok(Object.isFrozen(tool.parameters));
  }
  assert.deepEqual(VOICE_NAMES, readdirSync(join(ROOT, 'voices')).filter(f => f.endsWith('.md')).map(f => f.slice(0, -3)).sort());
  assert.deepEqual(tools[1].parameters.properties.name.enum, VOICE_NAMES);
  assert.deepEqual(JSON.parse(run(['--list-tools']).stdout), tools);
  assert.match(run(['--help']).stdout, /Usage:/);
});

test('dispatch uses real detector and normalized boolean flags', () => {
  assert.deepEqual(dispatch('cadence_analyze', { text }), analyze(text));
  assert.deepEqual(dispatch('cadence_analyze', { text, html: false, prose_only: false }), analyze(text));
  const markup = '<p>In today’s world, robust.</p>\n# Header\n\nSimple words.';
  const clean = stripMarkdown(stripHtml(markup));
  assert.deepEqual(dispatch('cadence_analyze', { text: markup, html: true, prose_only: true, paragraphs: true }), {
    ...analyze(clean), paragraphs: analyzeParagraphs(clean),
  });
  assert.deepEqual(dispatch('cadence_analyze', { text: '' }), analyze(''));
  assert.deepEqual(dispatch('cadence_analyze', { text: 'https://example.invalid/a' }), analyze('https://example.invalid/a'));
  const result = run(['cadence_analyze'], JSON.stringify({ text }));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), analyze(text));
});

test('validation rejects unknown tools, types, keys and unsafe voice paths', () => {
  assert.throws(() => dispatch('exec', {}));
  for (const args of [null, [], 'text', 4, {}, { text: 4 }, { text, path: '/tmp/file' }, { text, html: 'false' }, { text, paragraphs: 1 }, { text, prose_only: null }, JSON.parse('{"text":"a","__proto__":{}}')]) {
    assert.throws(() => dispatch('cadence_analyze', args));
  }
  for (const name of ['../plain', '../../package.json', '/etc/passwd', 'plain.md', 'plain/../kin', 'plain\\..\\kin', 'PLAIN', 'plain\0', '%2e%2e/plain', '', null]) {
    assert.throws(() => dispatch('cadence_voice', { name }));
  }
  assert.throws(() => dispatch('cadence_voice', { name: 'plain', path: 'voices/plain.md' }));
});

test('voices return full seed profiles and shared rules without summarizing', () => {
  for (const name of VOICE_NAMES) {
    assert.deepEqual(dispatch('cadence_voice', { name }), {
      name,
      profile: readFileSync(join(ROOT, 'voices', `${name}.md`), 'utf8'),
      rules: readFileSync(join(ROOT, 'skills/cadence/AGENTS.md'), 'utf8'),
    });
  }
});

test('CLI rejects malformed, multiple, empty, invalid UTF-8 and nonobject stdin', () => {
  for (const input of ['', '{', '{}{}', 'null', '[]', '"hello"', '{"text":42}', '{"text":"a","html":"false"}', Buffer.from([0xff])]) {
    rejectsCLI(['cadence_analyze'], input);
  }
  rejectsCLI([], '{}');
  rejectsCLI(['unknown'], '{}');
  rejectsCLI(['cadence_voice', 'plain'], '{}');
  rejectsCLI(['cadence_voice'], '{"name":"../plain"}');
});

test('UTF-8 text and transport bounds apply before parsing/stripping', () => {
  assert.doesNotThrow(() => dispatch('cadence_analyze', { text: ' '.repeat(MAX_TEXT_BYTES) }));
  assert.throws(() => dispatch('cadence_analyze', { text: ' '.repeat(MAX_TEXT_BYTES + 1) }), /limit/);
  assert.throws(() => dispatch('cadence_analyze', { text: 'é'.repeat(MAX_TEXT_BYTES / 2 + 1) }), /limit/);
  assert.throws(() => dispatch('cadence_analyze', { text: `<script>${' '.repeat(MAX_TEXT_BYTES)}</script>`, html: true }), /limit/);
  assert.throws(() => parseArguments(' '.repeat(MAX_REQUEST_BYTES + 1)), /limit/);
  assert.throws(() => parseArguments({}), /JSON string/);
  rejectsCLI(['cadence_analyze'], ' '.repeat(MAX_REQUEST_BYTES + 1));
  rejectsCLI(['cadence_analyze'], JSON.stringify({ text: 'é'.repeat(MAX_TEXT_BYTES) }));
  const escaped = '{"text":"' + '\\u0020'.repeat(MAX_TEXT_BYTES) + '"}';
  assert.equal(run(['cadence_analyze'], escaped).status, 0);
});

test('portable build works isolated from cwd, is deterministic and has no host registration', async () => {
  const base = temp();
  const dest = join(base, 'export');
  assert.equal(writeGrokBundle(dest).unchanged, false);
  assert.equal(writeGrokBundle(dest).unchanged, true);
  renameSync(dest, join(base, 'moved'));
  const moved = join(base, 'moved');
  const isolatedCLI = join(moved, 'integrations/grok/cli.mjs');
  const result = run(['cadence_analyze'], JSON.stringify({ text }), isolatedCLI, base);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), analyze(text));
  assert.deepEqual(JSON.parse(run(['cadence_voice'], '{"name":"plain"}', isolatedCLI, base).stdout), dispatch('cadence_voice', { name: 'plain' }));
  const exported = await import(pathToFileURL(join(moved, 'integrations/grok/tools.mjs')));
  assert.deepEqual(exported.tools, tools);
  const metadata = JSON.parse(readFileSync(join(moved, 'package.json')));
  assert.equal(metadata.version, JSON.parse(readFileSync(join(ROOT, 'package.json'))).version);
  assert.equal(metadata.dependencies, undefined);
  for (const path of ['SKILL.md', '.grok', 'agents', 'node_modules']) assert.equal(existsSync(join(moved, path)), false);
  const version = spawnSync(process.execPath, [join(moved, 'skills/cadence/scripts/deslop.mjs'), '--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0);
  assert.ok(version.stdout.includes(metadata.version));
  writeFileSync(join(moved, 'user-note.txt'), 'keep');
  assert.throws(() => writeGrokBundle(moved), /Refusing to overwrite/);
  assert.equal(readFileSync(join(moved, 'user-note.txt'), 'utf8'), 'keep');
});

test('voice file and directory symlinks are refused in exported bundles', () => {
  for (const component of ['voices/plain.md', 'voices', 'skills/cadence/AGENTS.md']) {
    const base = temp();
    const dest = join(base, 'bundle');
    writeGrokBundle(dest);
    const path = join(dest, component);
    renameSync(path, `${path}.original`);
    symlinkSync(`${path}.original`, path);
    const result = run(['cadence_voice'], '{"name":"plain"}', join(dest, 'integrations/grok/cli.mjs'));
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /regular files/);
    assert.throws(() => writeGrokBundle(dest), /symlink/);
  }
});

test('oversized seed is refused; builder rejects unsafe destinations and options', () => {
  const base = temp();
  const dest = join(base, 'bundle');
  writeGrokBundle(dest);
  writeFileSync(join(dest, 'voices/plain.md'), 'a'.repeat(MAX_TEXT_BYTES + 1));
  const result = run(['cadence_voice'], '{"name":"plain"}', join(dest, 'integrations/grok/cli.mjs'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /oversized/);
  symlinkSync(dest, join(base, 'link'));
  assert.throws(() => writeGrokBundle(join(base, 'link')), /not a regular directory/);
  writeFileSync(join(base, 'file'), 'keep');
  assert.throws(() => writeGrokBundle(join(base, 'file')), /not a regular directory/);
  const builder = join(ROOT, 'scripts/build-grok.mjs');
  for (const args of [['--out'], ['--unknown'], ['--out', dest, '--out', dest]]) {
    assert.equal(run(args, '', builder).status, 2);
  }
  const output = join(base, 'built via cli');
  assert.equal(run(['--out', output], '', builder).status, 0);
  assert.match(run(['--out', output], '', builder).stdout, /Verified/);
});

test('documented Responses loop executes against a fake host transport', async () => {
  const readme = readFileSync(join(ROOT, 'integrations/grok/README.md'), 'utf8');
  const example = readme.match(/```js\n([\s\S]*?)\n```/)[1];
  const source = example.replace("'./integrations/grok/tools.mjs'", JSON.stringify(pathToFileURL(join(ROOT, 'integrations/grok/tools.mjs')).href));
  const { runCadenceTurn } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const requests = [];
  const final = { id: 'second', output: [{ type: 'message', content: [] }] };
  const result = await runCadenceTurn({ model: 'host-model', prompt: 'host prompt', createResponse: async body => {
    requests.push(body);
    if (requests.length === 1) return { id: 'first', output: [
      { type: 'function_call', name: 'cadence_analyze', arguments: JSON.stringify({ text }), call_id: 'a' },
      { type: 'function_call', name: 'cadence_voice', arguments: '{"name":"plain"}', call_id: 'b' },
      { type: 'function_call', name: 'exec', arguments: '{}', call_id: 'c' },
    ] };
    return final;
  } });
  assert.equal(result, final);
  assert.equal(requests[1].previous_response_id, 'first');
  assert.deepEqual(requests[1].input.map(item => [item.type, item.call_id]), [['function_call_output', 'a'], ['function_call_output', 'b'], ['function_call_output', 'c']]);
  assert.deepEqual(JSON.parse(requests[1].input[0].output), analyze(text));
  assert.deepEqual(JSON.parse(requests[1].input[1].output), dispatch('cadence_voice', { name: 'plain' }));
  assert.ok(JSON.parse(requests[1].input[2].output).error);
});
