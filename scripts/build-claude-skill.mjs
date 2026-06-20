#!/usr/bin/env node
/**
 * Build a self-contained Cadence skill bundle for upload to a chat app that
 * accepts a zipped SKILL.md (claude.ai → Settings → Skills → Add → Upload skill).
 *
 * It copies SKILL.md + reference + scripts + the voices into one tree and
 * rewrites the plugin-root paths (`${CLAUDE_PLUGIN_ROOT:-.}/…`) to be relative
 * to the bundle root, so the detector and voices resolve once extracted.
 *
 * Output: cadence-skill.zip at the repo root. Requires the `zip` command,
 * which ships with macOS and Linux.
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync, mkdtempSync, mkdirSync, rmSync,
  readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function* mdFiles(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* mdFiles(p);
    else if (e.name.endsWith('.md')) yield p;
  }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL = join(ROOT, 'skills', 'cadence');
const OUT = join(ROOT, 'cadence-skill.zip');

const work = mkdtempSync(join(tmpdir(), 'cadence-skill-'));
const dest = join(work, 'cadence');
mkdirSync(dest, { recursive: true });

cpSync(join(SKILL, 'SKILL.md'), join(dest, 'SKILL.md'));
cpSync(join(SKILL, 'reference'), join(dest, 'reference'), { recursive: true });
cpSync(join(SKILL, 'scripts'), join(dest, 'scripts'), { recursive: true });
cpSync(join(ROOT, 'voices'), join(dest, 'voices'), { recursive: true });

for (const p of mdFiles(dest)) {
  const before = readFileSync(p, 'utf8');
  const after = before
    .replaceAll('${CLAUDE_PLUGIN_ROOT:-.}/skills/cadence/', '')
    .replaceAll('${CLAUDE_PLUGIN_ROOT:-.}/', '');
  if (after !== before) writeFileSync(p, after);
}

rmSync(OUT, { force: true });
execFileSync('zip', ['-rq', OUT, 'cadence'], { cwd: work });
rmSync(work, { recursive: true, force: true });

console.log(`Built ${OUT}`);
console.log('Upload it at claude.ai → Settings → Skills → Add → Upload skill.');
