#!/usr/bin/env node
// Optional integration smoke test: requires an installed Codex CLI, but makes no
// model request and installs no skill into the user's real home or repository.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { writeCodexBundle } from './codex-bundle.mjs';

const work = mkdtempSync(join(tmpdir(), 'cadence-codex-discovery-'));
const home = join(work, 'home');
const project = join(work, 'project');
const codexHome = join(home, '.codex');
mkdirSync(codexHome, { recursive: true });
mkdirSync(project);
writeCodexBundle(join(home, '.agents/skills/cadence'));
const child = spawn(process.env.CODEX_BINARY || 'codex', ['app-server', '--listen', 'stdio://'], {
  cwd: project, stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: codexHome },
});
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk; });
const lines = createInterface({ input: child.stdout });
const pending = new Map();
let nextId = 0;
const rejectAll = (error) => { for (const waiter of pending.values()) waiter.reject(error); pending.clear(); };
child.on('error', rejectAll);
const closed = new Promise((resolve) => child.once('close', (code) => {
  rejectAll(new Error(`Codex exited (${code}): ${stderr}`));
  resolve();
}));
lines.on('line', (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (!pending.has(message.id)) return;
  const waiter = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});
function request(method, params) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
const timeout = setTimeout(() => {
  rejectAll(new Error('Codex discovery timed out after 30 seconds.'));
  child.kill();
}, 30_000);

try {
  await request('initialize', { clientInfo: { name: 'cadence-release-check', version: '1.0.0' }, capabilities: { experimentalApi: true } });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }) + '\n');
  const result = await request('skills/list', { cwds: [project], forceReload: true });
  const entry = result.data.find((row) => row.cwd === project);
  assert.ok(entry, 'Codex did not return the fresh project');
  const skill = entry.skills.find((item) => item.name === 'cadence');
  assert.ok(skill, 'Codex did not discover the user-wide Cadence skill');
  assert.equal(skill.enabled, true);
  assert.equal(realpathSync(skill.path), realpathSync(join(home, '.agents/skills/cadence/SKILL.md')));
  assert.ok(!entry.errors.some((error) => error.path.includes('cadence')), JSON.stringify(entry.errors));
  console.log('Codex discovered the user-wide Cadence skill in a fresh project; no model call made.');
  console.log(JSON.stringify({ name: skill.name, scope: skill.scope, enabled: skill.enabled, path: skill.path }, null, 2));
  const local = join(project, '.agents/skills/cadence');
  writeCodexBundle(local);
  const localResult = await request('skills/list', { cwds: [project], forceReload: true });
  const localEntry = localResult.data.find((row) => row.cwd === project);
  const localSkill = localEntry?.skills.find((item) => item.name === 'cadence' && realpathSync(item.path) === realpathSync(join(local, 'SKILL.md')));
  assert.ok(localSkill, 'Codex did not discover the project-local Cadence skill');
  assert.equal(localSkill.enabled, true);
  console.log('Project-local discovery passed as well.');
} finally {
  clearTimeout(timeout);
  child.stdin.end();
  child.kill();
  await closed;
  lines.close();
  rmSync(work, { recursive: true, force: true });
}
