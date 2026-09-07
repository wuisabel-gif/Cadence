#!/usr/bin/env node
import { resolve } from 'node:path';
import { writeSkillBundle } from './agent-bundle.mjs';
import { SKILL_TARGETS, defaultSkillDirectory, parseSkillOptions, skillTarget } from './skill-targets.mjs';

const HELP = `Install a self-contained Cadence skill for a supported coding agent.

Usage:
  cadence-install-skill --agent <host>
  cadence-install-skill --agent <host> --project <path>
  cadence-install-skill --agent <host> --dest <skill-directory>
  cadence-install-skill --list

Hosts: ${Object.keys(SKILL_TARGETS).join(', ')}
ZCode supports user-wide installation here; use its UI for project imports.
No provider credentials, model IDs, approvals, or project instructions are changed.
Existing modified skills are never overwritten. --dest is an explicit directory;
it does not promise that a host will discover an arbitrary custom location.
`;

try {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log(HELP);
  } else if (args.length === 1 && args[0] === '--list') {
    for (const [id, target] of Object.entries(SKILL_TARGETS)) {
      const project = target.project ? `<project>/${target.project.join('/')}/cadence` : 'use ZCode UI import';
      console.log(`${id} (${target.label})\n  user: ${defaultSkillDirectory(id)}\n  project: ${project}\n  ${target.invoke}`);
    }
  } else {
    const options = parseSkillOptions(args, ['--agent', '--project', '--dest']);
    const agent = options['--agent'];
    const project = options['--project'] ? resolve(options['--project']) : undefined;
    const destination = options['--dest'] ? resolve(options['--dest']) : defaultSkillDirectory(agent, { project });
    const result = writeSkillBundle(destination, { agent });
    console.log(`${result.unchanged ? 'Already installed' : 'Installed'} Cadence for ${skillTarget(agent).label} at ${result.destination}`);
    console.log(skillTarget(agent).invoke);
    console.log('Node 18+ is required for scoring. Use the model already configured in your host.');
  }
} catch (error) {
  console.error(`Cadence install: ${error.message}`);
  process.exitCode = 2;
}
