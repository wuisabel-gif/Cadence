#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { ROOT, writeGrokBotPack } from './agent-bundle.mjs';

const HELP = `Pack Cadence for a Grok Bot cloud computer, or probe Node and git.

This command does not register a Grok Bot skill, publish to a marketplace, or
sign into Grok Bot. Save the private skill in the app after a real score.

Usage:
  node scripts/grok-bot-setup.mjs --pack [--out <directory>]
  node scripts/grok-bot-setup.mjs --probe
  node scripts/grok-bot-setup.mjs --score <file>

Default pack output: dist/grok-bot/cadence
`;

function probe() {
  const node = process.versions.node;
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
  const detector = join(ROOT, 'skills/cadence/scripts/deslop.mjs');
  const scored = spawnSync(process.execPath, [detector, '--version'], { encoding: 'utf8' });
  return {
    node,
    node_ok: Number(node.split('.')[0]) >= 18,
    git: git.status === 0 ? git.stdout.trim() : null,
    detector: scored.status === 0 ? scored.stdout.trim() : null,
  };
}

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(HELP);
  } else if (args.length === 1 && args[0] === '--probe') {
    const report = probe();
    console.log(JSON.stringify(report));
    if (!report.node_ok || !report.detector) process.exitCode = 2;
  } else if (args[0] === '--score') {
    const file = args[1];
    if (!file || args.length !== 2 || file.startsWith('-')) {
      throw new Error('Use --score <file>.');
    }
    const detector = join(ROOT, 'skills/cadence/scripts/deslop.mjs');
    const result = spawnSync(process.execPath, [detector, '--prose-only', '--json', resolve(file)], {
      encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
    });
    if (result.status !== 0) {
      process.stderr.write(result.stderr || result.stdout);
      process.exitCode = result.status === null ? 2 : result.status;
    } else {
      process.stdout.write(result.stdout);
    }
  } else if (args[0] === '--pack') {
    const rest = args.slice(1);
    if (rest.length && (rest.length !== 2 || rest[0] !== '--out' || !rest[1] || rest[1].startsWith('-'))) {
      throw new Error('Expected only --out <directory> after --pack.');
    }
    const destination = rest.length ? resolve(rest[1]) : join(ROOT, 'dist', 'grok-bot', 'cadence');
    const result = writeGrokBotPack(destination);
    console.log(`${result.unchanged ? 'Verified' : 'Packed'} ${result.destination} (${result.files} files)`);
    console.log('Copy that folder to /workspace/Cadence on the Grok Bot computer, then send SAVE_SKILL.md.');
  } else {
    throw new Error('Choose --pack, --probe, or --score. Use --help for usage.');
  }
} catch (error) {
  console.error(`Cadence Grok Bot setup: ${error.message}`);
  process.exitCode = 2;
}
