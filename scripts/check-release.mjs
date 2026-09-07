#!/usr/bin/env node
// Validate release metadata and exercise the actual npm tarball. Never publish,
// tag, alter installed skills, or depend on files outside the packed package.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './codex-bundle.mjs';
import { SKILL_TARGETS, defaultSkillDirectory } from './skill-targets.mjs';

const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const pkg = readJson('package.json');
const version = pkg.version;
assert.match(version, /^\d+\.\d+\.\d+$/);
for (const path of ['.claude-plugin/plugin.json', 'extension/manifest.json', 'integrations/gemini/gemini-extension.json', 'integrations/vscode/package.json']) {
  assert.equal(readJson(path).version, version, `${path} version differs from package.json`);
}
const marketplace = readJson('.claude-plugin/marketplace.json');
assert.equal(marketplace.plugins.find((plugin) => plugin.name === 'cadence')?.version, version);
assert.ok(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8').includes(`## [${version}]`), 'missing versioned release notes');
assert.equal(Object.keys(pkg.dependencies || {}).length, 0, 'the core must remain dependency-free');
assert.equal(pkg.bin['cadence-install-codex'], 'scripts/install-codex.mjs');
console.log(`Release versions agree: ${version}`);

const work = mkdtempSync(join(tmpdir(), 'cadence-release-'));
try {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const packed = JSON.parse(execFileSync(npm, ['pack', '--json', '--ignore-scripts', '--pack-destination', work], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, npm_config_cache: join(work, 'npm-cache') },
  }));
  assert.equal(packed.length, 1);
  assert.equal(packed[0].version, version);
  const paths = new Set(packed[0].files.map((file) => file.path));
  for (const path of [
    'scripts/install-codex.mjs', 'scripts/codex-bundle.mjs', 'scripts/build-codex.mjs',
    'integrations/agents/SKILL.md', 'integrations/codex/README.md', 'integrations/codex/agents/openai.yaml',
    'integrations/agents/README.md', 'integrations/kimi/README.md', 'integrations/zcode/README.md',
    'integrations/claude-code/README.md', 'integrations/opencode/README.md',
    'scripts/agent-bundle.mjs', 'scripts/skill-targets.mjs', 'scripts/install-agent-skill.mjs', 'scripts/build-agent-skill.mjs',
    'skills/cadence/AGENTS.md', 'skills/cadence/reference/voice-profile-schema.md',
    'skills/cadence/scripts/deslop.mjs', 'skills/cadence/scripts/extract-text.mjs',
    'LICENSE', 'SCORING.md', 'CHANGELOG.md', 'SECURITY.md',
    'MANUAL.md', 'docs/RELEASING.md', 'docs/releases/v0.3.0.md',
  ]) assert.ok(paths.has(path), `missing from npm package: ${path}`);
  const seeds = readdirSync(join(ROOT, 'voices')).filter((file) => file.endsWith('.md')).sort();
  for (const name of seeds) assert.ok(paths.has(`voices/${name}`), `missing packaged voice: ${name}`);
  assert.ok(![...paths].some((path) => path.startsWith('lora/') || path.startsWith('dist/') || path.startsWith('tests/')), 'unintended development artifacts packed');

  // tar is needed only by this developer check, not by the Node installer.
  execFileSync('tar', ['-xzf', join(work, packed[0].filename), '-C', work]);
  const packageRoot = join(work, 'package');
  const home = join(work, 'isolated-home');
  mkdirSync(home);
  const env = { ...process.env, HOME: home, USERPROFILE: home, KIMI_CODE_HOME: join(home, '.kimi-code') };
  execFileSync(process.execPath, [join(packageRoot, 'scripts/install-codex.mjs')], { cwd: home, env });
  const skill = join(home, '.agents/skills/cadence');
  const detector = join(skill, 'skills/cadence/scripts/deslop.mjs');
  assert.equal(execFileSync(process.execPath, [detector, '--version'], { cwd: home, encoding: 'utf8' }).trim(), version);
  assert.equal(readFileSync(join(skill, 'AGENTS.md'), 'utf8'), readFileSync(join(ROOT, 'skills/cadence/AGENTS.md'), 'utf8'));
  assert.deepEqual(readdirSync(join(skill, 'voices')).sort(), seeds);
  const draft = join(home, 'draft with spaces.md');
  writeFileSync(draft, '# Heading\n\nThe job finished. Open the CSV to check the rows.\n');
  const result = JSON.parse(execFileSync(process.execPath, [detector, '--prose-only', '--json', draft], { cwd: home, encoding: 'utf8' }));
  assert.equal(typeof result.score, 'number');
  assert.ok(Array.isArray(result.findings));
  assert.equal(result.metrics.sentences, 2);
  const built = join(work, 'standalone-build', 'cadence');
  execFileSync(process.execPath, [join(packageRoot, 'scripts/build-codex.mjs'), '--out', built], { cwd: home });
  assert.equal(readFileSync(join(built, 'SKILL.md'), 'utf8'), readFileSync(join(skill, 'SKILL.md'), 'utf8'));
  assert.equal(pkg.bin['cadence-install-skill'], 'scripts/install-agent-skill.mjs');
  for (const agent of Object.keys(SKILL_TARGETS)) {
    execFileSync(process.execPath, [join(packageRoot, 'scripts/install-agent-skill.mjs'), '--agent', agent], { cwd: home, env });
    const installed = defaultSkillDirectory(agent, { home, env });
    assert.equal(readFileSync(join(installed, 'SKILL.md'), 'utf8'), readFileSync(join(ROOT, 'integrations/agents/SKILL.md'), 'utf8'));
    assert.deepEqual(readdirSync(join(installed, 'voices')).sort(), seeds);
    const executable = join(installed, 'skills/cadence/scripts/deslop.mjs');
    assert.equal(execFileSync(process.execPath, [executable, '--version'], { cwd: home, encoding: 'utf8' }).trim(), version);
    const scored = JSON.parse(execFileSync(process.execPath, [executable, '--prose-only', '--json', draft], { cwd: home, encoding: 'utf8' }));
    assert.deepEqual(scored, result);
  }
  console.log(`npm tarball verified: ${packed[0].filename} (${paths.size} files, ${seeds.length} seed voices)`);
  console.log('Packed installs and local scoring passed for: ' + Object.keys(SKILL_TARGETS).join(', '));
  console.log('No package published, release created, or real user configuration changed.');
} finally {
  rmSync(work, { recursive: true, force: true });
}
