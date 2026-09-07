import {
  existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillTarget } from './skill-targets.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));

// Keep the original detector layout: its --version lookup reaches package.json
// three levels above skills/cadence/scripts/. No generated copy of the rules.
export function skillBundleFiles({ agent, root = ROOT }) {
  skillTarget(agent);
  const files = new Map();
  const add = (from, to = from) => files.set(to, readFileSync(join(root, from)));
  add('integrations/agents/SKILL.md', 'SKILL.md');
  if (agent === 'codex') add('integrations/codex/agents/openai.yaml', 'agents/openai.yaml');
  add('skills/cadence/AGENTS.md', 'AGENTS.md');
  add('skills/cadence/scripts/deslop.mjs');
  add('skills/cadence/scripts/extract-text.mjs');
  add('LICENSE');
  add('SCORING.md');
  for (const dir of ['voices', 'skills/cadence/reference']) {
    for (const entry of readdirSync(join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isFile() && entry.name.endsWith('.md')) add(`${dir}/${entry.name}`);
    }
  }
  const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  files.set('package.json', Buffer.from(JSON.stringify({
    name: `cadence-${agent}-skill`, version, private: true, type: 'module',
  }, null, 2) + '\n'));
  return files;
}

function treeFiles(dir, prefix = '') {
  const paths = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Refusing to replace a symlink: ${join(dir, entry.name)}`);
    if (entry.isDirectory()) paths.push(...treeFiles(join(dir, entry.name), `${path}/`));
    else if (entry.isFile()) paths.push(path);
    else throw new Error(`Not a regular file: ${join(dir, entry.name)}`);
  }
  return paths.sort();
}

// Never overwrite a user's skill or learned voices. Re-running an identical
// installation is a no-op; an upgrade requires the user to move the old one aside.
export function writeSkillBundle(destination, { agent, root = ROOT }) {
  const files = skillBundleFiles({ agent, root });
  const dest = resolve(destination);
  let current;
  try { current = lstatSync(dest); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current) {
    if (current.isSymbolicLink() || !current.isDirectory()) throw new Error(`Refusing to replace ${dest}: not a regular directory.`);
    const paths = treeFiles(dest);
    if (paths.length === files.size && paths.every((path) => files.has(path) && readFileSync(join(dest, path)).equals(files.get(path)))) {
      return { destination: dest, files: files.size, unchanged: true };
    }
    throw new Error(`Refusing to overwrite ${dest}. Back it up outside the skills directory, then rerun the command.`);
  }
  mkdirSync(dirname(dest), { recursive: true });
  mkdirSync(dest); // exclusive: a concurrently created installation is not ours
  try {
    for (const [path, contents] of files) {
      const target = join(dest, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents, { flag: 'wx' });
    }
  } catch (error) {
    // This invocation created dest; remove only its incomplete output on failure.
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    throw error;
  }
  return { destination: dest, files: files.size, unchanged: false };
}
