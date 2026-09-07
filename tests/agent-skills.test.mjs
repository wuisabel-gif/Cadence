import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, skillBundleFiles } from '../scripts/agent-bundle.mjs';
import { SKILL_TARGETS, defaultSkillDirectory } from '../scripts/skill-targets.mjs';

const cli = join(ROOT, 'scripts/install-agent-skill.mjs');
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const sources = readFileSync(join(ROOT, 'integrations/agents/SKILL.md'), 'utf8');
const rules = readFileSync(join(ROOT, 'skills/cadence/AGENTS.md'), 'utf8');
const seedNames = readdirSync(join(ROOT, 'voices')).filter((file) => file.endsWith('.md')).sort();
const userPaths = {
  codex: '.agents/skills/cadence', kimi: '.kimi-code/skills/cadence', zcode: '.zcode/skills/cadence',
  'claude-code': '.claude/skills/cadence', opencode: '.config/opencode/skills/cadence',
};
const projectPaths = {
  codex: '.agents/skills/cadence', kimi: '.kimi-code/skills/cadence',
  'claude-code': '.claude/skills/cadence', opencode: '.opencode/skills/cadence',
};

test('shared skill metadata fits the documented host format limits', () => {
  assert.match(sources, /^---\nname: cadence\ndescription: >-\n/);
  const description = sources.match(/description: >-\n((?:  [^\n]+\n)+)/)?.[1].trim();
  assert.ok(description && description.length <= 1024);
  assert.ok(Buffer.byteLength(sources) < 100 * 1024);
});

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'cadence agents '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
function run(home, args, env = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: home, encoding: 'utf8',
    env: { ...process.env, HOME: home, USERPROFILE: home, KIMI_CODE_HOME: '', ...env },
  });
}
function verifyBundle(dest, agent) {
  assert.equal(readFileSync(join(dest, 'SKILL.md'), 'utf8'), sources);
  assert.equal(readFileSync(join(dest, 'AGENTS.md'), 'utf8'), rules);
  assert.deepEqual(readdirSync(join(dest, 'voices')).sort(), seedNames);
  assert.equal(readFileSync(join(dest, 'voices/essence.md'), 'utf8'), readFileSync(join(ROOT, 'voices/essence.md'), 'utf8'));
  assert.equal(existsSync(join(dest, 'agents/openai.yaml')), agent === 'codex');
  const detector = join(dest, 'skills/cadence/scripts/deslop.mjs');
  assert.equal(readFileSync(detector, 'utf8'), readFileSync(join(ROOT, 'skills/cadence/scripts/deslop.mjs'), 'utf8'));
  assert.equal(execFileSync(process.execPath, [detector, '--version'], { encoding: 'utf8' }).trim(), version);
  const output = JSON.parse(execFileSync(process.execPath, [detector, '--json'], {
    encoding: 'utf8', input: 'The file is ready. Open it to check the rows.',
  }));
  assert.equal(output.metrics.sentences, 2);
  assert.equal(typeof output.score, 'number');
}

for (const agent of Object.keys(SKILL_TARGETS)) {
  test(`${agent}: user install ships the shared workflow and working detector`, (t) => {
    const home = fixture(t);
    const result = run(home, ['--agent', agent]);
    assert.equal(result.status, 0, result.stderr);
    const dest = join(home, userPaths[agent]);
    assert.equal(defaultSkillDirectory(agent, { home, env: {} }), dest);
    verifyBundle(dest, agent);
    assert.match(run(home, ['--agent', agent]).stdout, /Already installed/);
  });
  if (projectPaths[agent]) test(`${agent}: project install does not alter instructions, voices, or provider settings`, (t) => {
    const home = fixture(t);
    const project = join(home, 'project with spaces');
    mkdirSync(join(project, 'voices'), { recursive: true });
    mkdirSync(join(home, '.claude'), { recursive: true });
    const sentinels = [join(project, 'AGENTS.md'), join(project, 'CLAUDE.md'), join(project, 'voices/essence.md'), join(home, '.claude/settings.json')];
    for (const path of sentinels) writeFileSync(path, 'leave this user file alone\n');
    const result = run(home, ['--project', project, '--agent', agent]);
    assert.equal(result.status, 0, result.stderr);
    verifyBundle(join(project, projectPaths[agent]), agent);
    for (const path of sentinels) assert.equal(readFileSync(path, 'utf8'), 'leave this user file alone\n');
  });
}

test('Kimi uses the current KIMI_CODE_HOME and never guesses the legacy .kimi location', (t) => {
  const home = fixture(t);
  const root = join(home, 'custom kimi home');
  const result = run(home, ['--agent', 'kimi'], { KIMI_CODE_HOME: root });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(join(root, 'skills/cadence/SKILL.md')));
  assert.ok(!existsSync(join(home, '.kimi')));
  assert.ok(!existsSync(join(home, '.kimi-code')));
  assert.equal(defaultSkillDirectory('kimi', { home, env: { KIMI_CODE_HOME: '~/custom kimi home' } }), join(root, 'skills/cadence'));
  const invalid = run(home, ['--agent', 'kimi'], { KIMI_CODE_HOME: 'relative-path' });
  assert.equal(invalid.status, 2);
  assert.ok(!existsSync(join(home, 'relative-path')));
});

test('ZCode refuses undocumented project installation; explicit custom destinations are allowed', (t) => {
  const home = fixture(t);
  const project = join(home, 'project');
  const result = run(home, ['--agent', 'zcode', '--project', project]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Settings -> Skills -> Import -> Project/);
  assert.ok(!existsSync(project));
  const dest = join(home, 'chosen skill directory');
  assert.equal(run(home, ['--agent', 'zcode', '--dest', dest]).status, 0);
  verifyBundle(dest, 'zcode');
});

test('general installer refuses modified, unrelated, or symlinked skill destinations', (t) => {
  const home = fixture(t);
  const dest = join(home, 'existing');
  assert.equal(run(home, ['--agent', 'kimi', '--dest', dest]).status, 0);
  writeFileSync(join(dest, 'voices/custom.md'), 'keep my voice');
  assert.equal(run(home, ['--agent', 'kimi', '--dest', dest]).status, 2);
  assert.equal(readFileSync(join(dest, 'voices/custom.md'), 'utf8'), 'keep my voice');
  const link = join(home, 'linked');
  symlinkSync(dest, link, 'dir');
  assert.equal(run(home, ['--agent', 'opencode', '--dest', link]).status, 2);
  const unrelated = join(home, 'unrelated');
  mkdirSync(unrelated);
  writeFileSync(join(unrelated, 'SKILL.md'), 'user content');
  assert.equal(run(home, ['--agent', 'zcode', '--dest', unrelated]).status, 2);
  assert.equal(readFileSync(join(unrelated, 'SKILL.md'), 'utf8'), 'user content');
});

test('bad host names, duplicate flags, missing values, and mixed scopes cause no writes', (t) => {
  const home = fixture(t);
  for (const args of [[], ['--agent'], ['--agent', 'kimi3'], ['--agent', '../kimi'], ['--agent', '__proto__'],
    ['--agent', 'kimi', '--agent', 'zcode'], ['--agent', 'kimi', '--dest'], ['--agent', 'kimi', '--force'],
    ['--agent', 'kimi', '--project', home, '--dest', join(home, 'cadence')]]) {
    assert.equal(run(home, args).status, 2, args.join(' '));
  }
  assert.deepEqual(readdirSync(home), []);
  assert.equal(run(home, ['--help']).status, 0);
  assert.equal(run(home, ['--list']).status, 0);
  assert.deepEqual(readdirSync(home), []);
});

test('every host builds reproducibly outside the repo, with no model-specific instructions', (t) => {
  const dir = fixture(t);
  for (const agent of Object.keys(SKILL_TARGETS)) {
    const dest = join(dir, agent, 'cadence');
    const args = [join(ROOT, 'scripts/build-agent-skill.mjs'), '--agent', agent, '--out', dest];
    execFileSync(process.execPath, args, { cwd: dir });
    const again = execFileSync(process.execPath, args, { cwd: dir, encoding: 'utf8' });
    assert.match(again, /Verified/);
    assert.equal(skillBundleFiles({ agent }).get('SKILL.md').toString(), sources);
    assert.doesNotMatch(readFileSync(join(dest, 'SKILL.md'), 'utf8'), /Kimi K3|GLM-5\.3|api[_-]?key\s*[:=]|ANTHROPIC_BASE_URL/);
  }
});
