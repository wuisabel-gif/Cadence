#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { ROOT, writeCodexBundle } from './codex-bundle.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/build-codex.mjs [--out <skill-directory>]');
    console.log('Default: dist/codex/cadence. Move an older build aside before rebuilding changed sources.');
  } else {
    if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1] || args[1].startsWith('-'))) {
      throw new Error('Use --out <skill-directory> or --help.');
    }
    const result = writeCodexBundle(args.length ? resolve(args[1]) : join(ROOT, 'dist', 'codex', 'cadence'));
    console.log(`${result.unchanged ? 'Verified' : 'Built'} ${result.destination} (${result.files} files)`);
  }
} catch (error) {
  console.error(`Cadence build: ${error.message}`);
  process.exitCode = 2;
}
