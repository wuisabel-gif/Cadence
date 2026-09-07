#!/usr/bin/env node
// Optional smoke test for the current Kimi Code CLI's documented, session-less
// skill catalog. No model/provider setup, prompt, session, or real-home changes.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSkillBundle } from './agent-bundle.mjs';

const work = mkdtempSync(join(tmpdir(), 'cadence-kimi-discovery-'));
const home = join(work, 'home');
const kimiHome = join(home, '.kimi-code');
const userProject = join(work, 'user-project');
const localProject = join(work, 'local-project');
let child, closed;
try {
  for (const path of [home, kimiHome, join(userProject, '.git'), join(localProject, '.git')]) mkdirSync(path, { recursive: true });
  const userSkill = join(kimiHome, 'skills/cadence');
  const localSkill = join(localProject, '.kimi-code/skills/cadence');
  writeSkillBundle(userSkill, { agent: 'kimi' });
  writeSkillBundle(localSkill, { agent: 'kimi' });

  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  child = spawn(process.env.KIMI_BINARY || 'kimi', ['web', '--no-open', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: userProject, stdio: ['ignore', 'pipe', 'pipe'],
    // Do not forward provider keys, tokens, or custom configuration from the user.
    env: { PATH: process.env.PATH, HOME: home, USERPROFILE: home, KIMI_CODE_HOME: kimiHome,
      XDG_CONFIG_HOME: join(home, '.config'), XDG_DATA_HOME: join(home, '.local/share'),
      XDG_CACHE_HOME: join(home, '.cache'), NO_COLOR: '1', ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}) },
  });
  closed = new Promise((resolve) => child.once('close', resolve));
  const endpoint = await new Promise((resolve, reject) => {
    let banner = '';
    const timer = setTimeout(() => finish(new Error('Kimi did not expose its local authenticated URL within 30 seconds.')), 30_000);
    const finish = (error, value) => {
      clearTimeout(timer);
      child.stdout.off('data', collect); child.stderr.off('data', collect);
      child.off('error', failed); child.off('close', exited);
      child.stdout.resume(); child.stderr.resume();
      error ? reject(error) : resolve(value);
    };
    const failed = () => finish(new Error('Could not start Kimi Code CLI. Install it or set KIMI_BINARY.'));
    const exited = () => finish(new Error('Kimi exited before startup. The session-less web API is required.'));
    const collect = (chunk) => {
      banner = (banner + chunk).slice(-32_768);
      const match = banner.match(/http:\/\/127\.0\.0\.1:\d+\/#token=([^\s\x1b]+)/);
      if (match) finish(null, new URL(match[0]));
    };
    child.on('error', failed); child.on('close', exited);
    child.stdout.on('data', collect); child.stderr.on('data', collect);
  });
  // Keep the ephemeral bearer credential only in memory; never print the banner.
  const token = decodeURIComponent(endpoint.hash.slice('#token='.length));
  const api = async (path, body) => {
    const response = await fetch(endpoint.origin + '/api/v1' + path, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json();
    assert.ok(response.ok && payload.code === 0, `Kimi catalog request failed: HTTP ${response.status}, code ${payload.code}`);
    return payload.data;
  };
  for (const [root, expected, scope] of [[userProject, userSkill, 'user'], [localProject, localSkill, 'project']]) {
    const workspace = await api('/workspaces', { root, name: `Cadence ${scope} smoke test` });
    assert.equal(typeof workspace.id, 'string');
    const catalog = await api(`/workspaces/${encodeURIComponent(workspace.id)}/skills`);
    const skill = catalog.skills.find((entry) => entry.name === 'cadence');
    assert.ok(skill, `Kimi did not discover the ${scope} skill`);
    assert.equal(realpathSync(skill.path), realpathSync(join(expected, 'SKILL.md')));
    assert.equal(skill.source, scope);
    assert.notEqual(skill.disable_model_invocation, true);
    console.log(`Kimi Code discovered Cadence in ${scope} scope; no model call made.`);
  }
} finally {
  if (child) {
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.kill();
    await closed;
    clearTimeout(timer);
  }
  rmSync(work, { recursive: true, force: true });
}
