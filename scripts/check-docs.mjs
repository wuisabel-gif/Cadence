#!/usr/bin/env node
// Dogfood the detector on the project's own prose. Each file has a score ceiling;
// add new docs here instead of growing an npm-script chain.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './codex-bundle.mjs';

const DOCS = {
  'README.md': 10,
  'CONTRIBUTING.md': 10,
  'PHILOSOPHY.md': 15,
  'CHANGELOG.md': 10,
  'MANUAL.md': 12,
  'tutorials/scan-a-repo.md': 10,
  'SCORING.md': 10,
  'integrations/codex/README.md': 10,
  'docs/RELEASING.md': 10,
  'docs/releases/v0.3.0.md': 10,
  'docs/releases/v0.4.0.md': 10,
  'docs/embed.md': 10,
  'benchmark/README.md': 10,
};

const AGENT_DOCS = {
  'integrations/agents/README.md': 10,
  'integrations/agents/SKILL.md': 10,
  'integrations/kimi/README.md': 10,
  'integrations/zcode/README.md': 10,
  'integrations/claude-code/README.md': 10,
  'integrations/opencode/README.md': 10,
  'integrations/grok-bot/README.md': 10,
};

const files = process.argv.includes('--agents') ? AGENT_DOCS : DOCS;
const detector = join(ROOT, 'skills/cadence/scripts/deslop.mjs');
let failed = 0;
for (const [file, max] of Object.entries(files)) {
  const run = spawnSync(process.execPath, [detector, '--prose-only', '--max', String(max), join(ROOT, file)], { stdio: 'inherit' });
  if (run.status !== 0) failed++;
}
if (failed) {
  console.error(`${failed} doc(s) exceeded their ceiling.`);
  process.exit(1);
}
