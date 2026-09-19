#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { ROOT, writeGrokBundle } from './agent-bundle.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/build-grok.mjs [--out <bundle-directory>]');
    console.log('Default: dist/grok/cadence. Portable local bridge; no host registration.');
    console.log('Identical output is a no-op; changed existing trees are never overwritten.');
  } else {
    if (args.length && (args.length !== 2 || args[0] !== '--out' || !args[1] || args[1].startsWith('-'))) {
      throw new Error('Expected only --out <bundle-directory>.');
    }
    const destination = args.length ? resolve(args[1]) : join(ROOT, 'dist', 'grok', 'cadence');
    const result = writeGrokBundle(destination);
    console.log(`${result.unchanged ? 'Verified' : 'Built'} ${result.destination} (${result.files} files)`);
  }
} catch (error) {
  console.error(`Cadence Grok build: ${error.message}`);
  process.exitCode = 2;
}
