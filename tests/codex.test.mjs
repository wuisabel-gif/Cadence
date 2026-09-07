import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, codexBundleFiles, writeCodexBundle } from '../scripts/codex-bundle.mjs';

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const detectorPath = 'skills/cadence/scripts/deslop.mjs';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cadence codex '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function install(args, home) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts/install-codex.mjs'), ...args], {
    cwd: home, encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home },
  });
}

function score(detector, file, cwd) {
  return JSON.parse(execFileSync(process.execPath, [detector, '--prose-only', '--json', file], { cwd, encoding: 'utf8' }));
}

test('Codex bundle has a discoverable skill and exact shared rules, voices, and detector', (t) => {
  const dir = fixture(t);
  const dest = join(dir, 'cadence');
  writeCodexBundle(dest);
  const files = codexBundleFiles();
  assert.match(files.get('SKILL.md').toString(), /^---\nname: cadence\ndescription:/);
  assert.match(files.get('agents/openai.yaml').toString(), /allow_implicit_invocation: true/);
  assert.match(files.get('agents/openai.yaml').toString(), /Use \$cadence/);
  assert.equal(readFileSync(join(dest, 'AGENTS.md'), 'utf8'), readFileSync(join(ROOT, 'skills/cadence/AGENTS.md'), 'utf8'));
  assert.equal(readFileSync(join(dest, detectorPath), 'utf8'), readFileSync(join(ROOT, detectorPath), 'utf8'));
  const seeds = readdirSync(join(ROOT, 'voices')).filter((name) => name.endsWith('.md')).sort();
  assert.deepEqual(readdirSync(join(dest, 'voices')).sort(), seeds);
  for (const name of seeds) {
    assert.equal(readFileSync(join(dest, 'voices', name), 'utf8'), readFileSync(join(ROOT, 'voices', name), 'utf8'));
  }
  assert.ok(files.has('skills/cadence/reference/voice-profile-schema.md'));
  assert.equal(execFileSync(process.execPath, [join(dest, detectorPath), '--version'], { cwd: dir, encoding: 'utf8' }).trim(), version);
});

test('installer supports fresh user-wide and project-local discovery paths without editing instructions', (t) => {
  const dir = fixture(t);
  const home = join(dir, 'home');
  const project = join(dir, 'project with spaces');
  mkdirSync(home);
  mkdirSync(project);
  writeFileSync(join(project, 'AGENTS.md'), 'Keep project instructions.\n');
  mkdirSync(join(home, '.codex'));
  writeFileSync(join(home, '.codex', 'config.toml'), '# Keep Codex settings.\n');
  const userRun = install([], home);
  assert.equal(userRun.status, 0, userRun.stderr);
  assert.ok(existsSync(join(home, '.agents/skills/cadence/SKILL.md')));
  const localRun = install(['--project', project], home);
  assert.equal(localRun.status, 0, localRun.stderr);
  assert.ok(existsSync(join(project, '.agents/skills/cadence/voices/essence.md')));
  assert.equal(readFileSync(join(project, 'AGENTS.md'), 'utf8'), 'Keep project instructions.\n');
  assert.equal(readFileSync(join(home, '.codex', 'config.toml'), 'utf8'), '# Keep Codex settings.\n');
});

test('installed detector scores before/after fixtures from an unrelated working directory', (t) => {
  const dir = fixture(t);
  const dest = join(dir, 'installed skill');
  writeCodexBundle(dest);
  const before = join(dir, 'before draft.md');
  const after = join(dir, 'after draft.md');
  const scaffolding = '# Heading\n\n```js\nconst example = "robust";\n```\n\n[Guide](https://example.invalid/guide)\n\n';
  writeFileSync(before, scaffolding + "In today's world, we leverage robust and seamless tools to unlock the power of your data.\n");
  writeFileSync(after, scaffolding + 'The tool exports the rows you select. Save them as CSV, then open the file in your spreadsheet.\n');
  const first = score(join(dest, detectorPath), before, dir);
  const last = score(join(dest, detectorPath), after, dir);
  assert.deepEqual(first, score(join(ROOT, detectorPath), before, dir));
  assert.deepEqual(last, score(join(ROOT, detectorPath), after, dir));
  assert.ok(first.score > last.score);
  assert.ok(first.findings.length > last.findings.length);
  assert.ok(readFileSync(before, 'utf8').startsWith(scaffolding), 'scoring must not rewrite the file');
  assert.ok(readFileSync(after, 'utf8').startsWith(scaffolding));
});

test('installer is idempotent but refuses modified installations and added voices', (t) => {
  const dir = fixture(t);
  const dest = join(dir, 'cadence');
  const args = ['--dest', dest];
  assert.equal(install(args, dir).status, 0);
  assert.match(install(args, dir).stdout, /Already installed/);
  writeFileSync(join(dest, 'voices/custom.md'), '# My voice\n');
  const withVoice = install(args, dir);
  assert.equal(withVoice.status, 2);
  assert.match(withVoice.stderr, /Refusing to overwrite/);
  assert.equal(readFileSync(join(dest, 'voices/custom.md'), 'utf8'), '# My voice\n');
  writeFileSync(join(dest, 'SKILL.md'), 'User-modified skill\n');
  assert.equal(install(args, dir).status, 2);
  assert.equal(readFileSync(join(dest, 'SKILL.md'), 'utf8'), 'User-modified skill\n');
});

test('installer refuses symlink destinations and malformed flags', (t) => {
  const dir = fixture(t);
  const real = join(dir, 'real');
  mkdirSync(real);
  const link = join(dir, 'cadence');
  symlinkSync(real, link, 'dir');
  assert.equal(install(['--dest', link], dir).status, 2);
  assert.deepEqual(readdirSync(real), []);
  for (const args of [['--project'], ['--dest'], ['--force'], ['--dest', '--help'], ['--project', dir, '--dest', real]]) {
    assert.equal(install(args, dir).status, 2, args.join(' '));
  }
  assert.equal(install(['--help'], dir).status, 0);
  assert.ok(!existsSync(join(dir, '.agents')));
});

test('Codex build works outside the repo and is deterministic', (t) => {
  const dir = fixture(t);
  const dest = join(dir, 'build/cadence');
  const args = [join(ROOT, 'scripts/build-codex.mjs'), '--out', dest];
  execFileSync(process.execPath, args, { cwd: dir });
  const original = [...codexBundleFiles().keys()].map((path) => readFileSync(join(dest, path), 'utf8'));
  execFileSync(process.execPath, args, { cwd: dir });
  assert.deepEqual([...codexBundleFiles().keys()].map((path) => readFileSync(join(dest, path), 'utf8')), original);
});
