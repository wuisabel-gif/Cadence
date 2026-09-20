import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, writeGrokBotPack } from '../scripts/agent-bundle.mjs';

const setup = join(ROOT, 'scripts/grok-bot-setup.mjs');
const run = (args, cwd = tmpdir()) => spawnSync(process.execPath, [setup, ...args], {
  cwd, encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024,
});

test('probe reports this machine Node, git, and detector version', () => {
  const result = run(['--probe']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.node, process.versions.node);
  assert.equal(report.node_ok, true);
  assert.match(report.git, /^git version /);
  assert.equal(report.detector, JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version);
});

test('pack writes the shared skill, SAVE_SKILL prompt, and a working detector', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'cadence-grok-bot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const dest = join(dir, 'cadence');
  const packed = run(['--pack', '--out', dest]);
  assert.equal(packed.status, 0, packed.stderr);
  assert.match(packed.stdout, /Packed/);
  assert.equal(
    readFileSync(join(dest, 'SAVE_SKILL.md'), 'utf8'),
    readFileSync(join(ROOT, 'integrations/grok-bot/SAVE_SKILL.md'), 'utf8'),
  );
  assert.equal(
    readFileSync(join(dest, 'README.md'), 'utf8'),
    readFileSync(join(ROOT, 'integrations/grok-bot/README.md'), 'utf8'),
  );
  const detector = join(dest, 'skills/cadence/scripts/deslop.mjs');
  const draft = join(dir, 'draft.md');
  writeFileSync(draft, '# Heading\n\nThe bus arrived. I got on.\n');
  const scored = spawnSync(process.execPath, [detector, '--prose-only', '--json', draft], { encoding: 'utf8' });
  assert.equal(scored.status, 0, scored.stderr);
  const output = JSON.parse(scored.stdout);
  assert.equal(typeof output.score, 'number');
  assert.equal(output.metrics.sentences, 2);
  assert.match(run(['--pack', '--out', dest]).stdout, /Verified/);
});

test('score uses the bundled detector and setup refuses a fake Bot install path', () => {
  const draft = join(ROOT, 'README.md');
  const scored = run(['--score', draft]);
  assert.equal(scored.status, 0, scored.stderr);
  const output = JSON.parse(scored.stdout);
  assert.equal(typeof output.score, 'number');
  assert.equal(run([]).status, 2);
  assert.match(run([]).stderr, /Choose --pack, --probe, or --score/);
  assert.equal(typeof writeGrokBotPack, 'function');
});
