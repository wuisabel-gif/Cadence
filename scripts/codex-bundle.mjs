// Compatibility entry points for the original Codex installer and release checks.
// All agents share one bundle builder and one set of writing instructions.
import { ROOT, skillBundleFiles, writeSkillBundle } from './agent-bundle.mjs';
export { ROOT };

export function codexBundleFiles(root = ROOT) {
  return skillBundleFiles({ agent: 'codex', root });
}

export function writeCodexBundle(destination, { root = ROOT } = {}) {
  return writeSkillBundle(destination, { agent: 'codex', root });
}
