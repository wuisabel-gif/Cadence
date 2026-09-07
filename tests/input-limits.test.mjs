import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_INPUT_BYTES } from '../skills/cadence/scripts/deslop.mjs';

const detector = fileURLToPath(new URL('../skills/cadence/scripts/deslop.mjs', import.meta.url));

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-limits-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function assertLimit(result) {
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /exceeds the 5 MiB limit/);
  assert.doesNotMatch(result.stderr, /at .*\.mjs:\d+|RangeError:/);
  assert.equal(result.stdout, '', 'never print a stale or partial score');
}

test('CLI rejects oversized files and directory entries before stripping markup', (t) => {
  const dir = fixture(t);
  const file = join(dir, 'large.md');
  writeFileSync(file, '```\n' + 'x'.repeat(MAX_INPUT_BYTES) + '\n```\n');
  assertLimit(spawnSync(process.execPath, [detector, '--json', '--prose-only', file], { encoding: 'utf8' }));
  assertLimit(spawnSync(process.execPath, [detector, '--json', dir], { encoding: 'utf8' }));
});

test('CLI stdin limit counts UTF-8 bytes, not characters', () => {
  assertLimit(spawnSync(process.execPath, [detector, '--json'], {
    input: 'é'.repeat(MAX_INPUT_BYTES / 2 + 1), encoding: 'utf8', maxBuffer: 1024 * 1024,
  }));
});

test('CLI stops oversized stdin before the producer sends EOF', { timeout: 10_000 }, async (t) => {
  const child = spawn(process.execPath, [detector, '--json'], { stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(() => child.kill());
  let stderr = '', stdout = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stdin.on('error', (error) => { if (error.code !== 'EPIPE') throw error; });
  const exit = once(child, 'close');
  child.stdin.write(Buffer.alloc(MAX_INPUT_BYTES + 1, 120));
  // Do not call end(): a correct limit check terminates without waiting for EOF.
  const [status] = await exit;
  assertLimit({ status, stderr, stdout });
});

test('CLI missing files report a readable error rather than a stack trace', (t) => {
  const file = join(fixture(t), 'missing.md');
  const result = spawnSync(process.execPath, [detector, file], { encoding: 'utf8' });
  assert.equal(result.status, 3);
  assert.match(result.stderr, /ENOENT/);
  assert.doesNotMatch(result.stderr, /at .*\.mjs:\d+/);
});
