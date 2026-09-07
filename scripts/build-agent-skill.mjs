#!/usr/bin/env node
import { join, resolve } from 'node:path';
import { ROOT, writeSkillBundle } from './agent-bundle.mjs';
import { parseSkillOptions } from './skill-targets.mjs';

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('Usage: node scripts/build-agent-skill.mjs --agent <host> [--out <skill-directory>]');
    console.log('Default: dist/<host>/cadence. Changed existing trees are never overwritten.');
  } else {
    const options = parseSkillOptions(args, ['--agent', '--out']);
    const agent = options['--agent'];
    const dest = options['--out'] ? resolve(options['--out']) : join(ROOT, 'dist', agent, 'cadence');
    const result = writeSkillBundle(dest, { agent });
    console.log(`${result.unchanged ? 'Verified' : 'Built'} ${result.destination} (${result.files} files)`);
  }
} catch (error) {
  console.error(`Cadence build: ${error.message}`);
  process.exitCode = 2;
}
