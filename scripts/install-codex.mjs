#!/usr/bin/env node
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { writeCodexBundle } from './codex-bundle.mjs';

const HELP = `Install the Cadence Codex skill (Node 18+, no dependencies).

Usage:
  cadence-install-codex                    install for this user
  cadence-install-codex --project <path>   install for one project
  cadence-install-codex --dest <path>      choose the exact skill directory
  cadence-install-codex --help             show this help

Default: ~/.agents/skills/cadence
Project: <path>/.agents/skills/cadence
No AGENTS.md or Codex configuration is modified. Existing skills are never
replaced: identical installs are a no-op; move an older install aside to upgrade.
`;

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(HELP);
  } else {
    let destination = join(homedir(), '.agents', 'skills', 'cadence');
    if (args.length) {
      if (args.length !== 2 || !['--project', '--dest'].includes(args[0]) || !args[1] || args[1].startsWith('-')) {
        throw new Error('Use --project <path> or --dest <path>, or --help for usage.');
      }
      destination = args[0] === '--project'
        ? join(resolve(args[1]), '.agents', 'skills', 'cadence')
        : resolve(args[1]);
    }
    const result = writeCodexBundle(destination);
    console.log(`${result.unchanged ? 'Already installed' : 'Installed'} Cadence at ${result.destination}`);
    console.log('Start a new Codex session and ask: Use Cadence to recast README.md in the essence voice.');
    console.log('You can also select $cadence explicitly. The bundled detector runs locally with Node.');
  }
} catch (error) {
  console.error(`Cadence install: ${error.message}`);
  process.exitCode = 2;
}
