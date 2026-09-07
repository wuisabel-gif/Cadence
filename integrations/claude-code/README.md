# Cadence in Claude Code with another provider

If the Cadence Claude Code plugin is already installed and working, changing the
model provider does not require another Cadence installation. Keep using that
plugin's command. The skill does not implement a provider protocol.

For a standalone skill without the marketplace plugin, run from this checkout:

```bash
npm run install:claude
# Or only for one repository:
npm run install:claude -- --project /path/to/project
```

This uses `~/.claude/skills/cadence/` or `<project>/.claude/skills/cadence/`. Invoke
`/cadence` or ask Claude Code to use Cadence. The bundle includes the same rules,
voice profiles, and detector as the other install targets.

```text
/cadence recast README.md in the punchy voice and verify the edit.
```

Use Kimi or GLM only through a provider/client setup that supports it. Cadence
neither configures that connection nor guarantees access to a particular model.
No keys, endpoint variables, or Claude settings are changed by the installer.
If you use a custom Claude configuration directory, pass the actual skill path
with `--dest` and confirm discovery in your client.

Avoid keeping redundant versions of the plugin and standalone skill. They can
have different command namespaces or precedence; inspect which source is loaded
before evaluating the result. A working standalone copy can be removed after you
back up any edits, without touching project voices or Claude configuration.

The detector needs Node 18 or newer in the execution environment. Respect all
file/shell approval settings. Scoring may be local while the host's model requests
are remote; this installer does not change that privacy boundary.

See the [shared guide](../agents/README.md) and
[Claude Code's official skill documentation](https://code.claude.com/docs/en/skills).
