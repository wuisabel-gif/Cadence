import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

// Host capabilities, not model versions. Keep paths tied to the vendor docs
// linked in integrations/agents/README.md. Never infer an undocumented scope.
export const SKILL_TARGETS = Object.freeze({
  codex: {
    label: 'Codex', user: ['.agents', 'skills'], project: ['.agents', 'skills'],
    invoke: 'Start a new session and select $cadence, or ask to use Cadence.',
  },
  kimi: {
    label: 'Kimi Code CLI', user: ['.kimi-code', 'skills'], project: ['.kimi-code', 'skills'],
    invoke: 'Start a new session and use /skill:cadence, or ask to use Cadence.',
  },
  zcode: {
    label: 'ZCode Agent', user: ['.zcode', 'skills'], project: null,
    invoke: 'In Settings -> Skills, click Refresh and enable Cadence; invoke $cadence.',
  },
  'claude-code': {
    label: 'Claude Code', user: ['.claude', 'skills'], project: ['.claude', 'skills'],
    invoke: 'Select /cadence, or ask to use Cadence. Existing plugins need no provider-specific reinstall.',
  },
  opencode: {
    label: 'OpenCode', user: ['.config', 'opencode', 'skills'], project: ['.opencode', 'skills'],
    invoke: 'Start a new session and ask OpenCode to load the cadence skill.',
  },
});

export function skillTarget(agent) {
  if (!Object.hasOwn(SKILL_TARGETS, agent)) {
    throw new Error(`Unknown agent "${agent}". Choose: ${Object.keys(SKILL_TARGETS).join(', ')}.`);
  }
  return SKILL_TARGETS[agent];
}

export function defaultSkillDirectory(agent, { home = homedir(), project, env = process.env } = {}) {
  const target = skillTarget(agent);
  if (project !== undefined) {
    if (!target.project) {
      throw new Error('ZCode project skill paths are not documented. Install user-wide, or use Settings -> Skills -> Import -> Project.');
    }
    return join(project, ...target.project, 'cadence');
  }
  if (agent === 'kimi' && env.KIMI_CODE_HOME) {
    const root = env.KIMI_CODE_HOME.startsWith('~/') ? join(home, env.KIMI_CODE_HOME.slice(2)) : env.KIMI_CODE_HOME;
    if (!isAbsolute(root)) throw new Error('KIMI_CODE_HOME must be an absolute path (or start with ~/).');
    return join(root, 'skills', 'cadence');
  }
  return join(home, ...target.user, 'cadence');
}

export function parseSkillOptions(args, allowed) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (!allowed.includes(key) || Object.hasOwn(options, key) || !value || value.startsWith('-')) {
      throw new Error(`Invalid or repeated option: ${key}. Use --help for usage.`);
    }
    options[key] = value;
  }
  if (!options['--agent']) throw new Error('Choose a host with --agent. Use --list to see supported hosts.');
  skillTarget(options['--agent']);
  if (options['--project'] && options['--dest']) throw new Error('Choose either --project or --dest, not both.');
  return options;
}
