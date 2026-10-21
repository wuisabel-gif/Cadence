#!/usr/bin/env node
// Run every model-free host discovery check this machine can run, and name the
// hosts that still need the manual sign-off in docs/RELEASING.md.
// ponytail: hosts without a session-less skill listing stay manual; add a check
// here when one ships such an API.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './codex-bundle.mjs';

const CHECKS = [
  { host: 'Codex', bin: process.env.CODEX_BINARY || 'codex', script: 'check-codex-discovery.mjs' },
  { host: 'Kimi Code CLI', bin: process.env.KIMI_BINARY || 'kimi', script: 'check-kimi-discovery.mjs' },
];
const MANUAL = ['ZCode', 'Claude Code', 'OpenCode', 'Grok Build'];

const installed = (bin) => spawnSync(bin, ['--version'], { stdio: 'ignore' }).error === undefined;
let failed = 0;
for (const { host, bin, script } of CHECKS) {
  if (!installed(bin)) { console.log(`skip  ${host}: ${bin} not found`); continue; }
  const run = spawnSync(process.execPath, [join(ROOT, 'scripts', script)], { stdio: 'inherit' });
  console.log(`${run.status === 0 ? 'pass' : 'FAIL'}  ${host}`);
  if (run.status !== 0) failed++;
}
console.log(`manual sign-off still needed: ${MANUAL.join(', ')}`);
process.exit(failed ? 1 : 0);
