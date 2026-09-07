# Cadence in OpenCode

Pick your model in OpenCode first. Cadence leaves that choice alone. If your
provider supports Kimi or GLM, the same skill can check prose written by either
model without separate setup. No credentials are requested.

From this checkout:

```bash
npm run install:opencode
# Or just for one project:
npm run install:opencode -- --project /path/to/project
```

The default paths are `~/.config/opencode/skills/cadence/` and
`<project>/.opencode/skills/cadence/`. For a non-default configuration root, use
`--dest <actual-skill-directory>` and verify that OpenCode scans that location.

Start a new session, then ask:

```text
Load the cadence skill and recast README.md in the essence voice.
Use Cadence to score this documentation without changing any files.
```

OpenCode discovers skills and loads their bodies through its native skill tool.
Do not assume a skill name creates a slash command. Ensure your chosen agent can
use the skill tool and run Node. If skill or shell permissions are denied, leave
them intact and report the unverified result rather than bypassing the policy.

OpenCode can also discover Claude-compatible and `.agents/skills` locations. If a
Cadence install is already visible there, you may not need another copy. Inspect
the loaded source and remove redundant copies only after backing up your changes.

Scoring uses Node 18 or newer and the bundled detector; the writing model remains
under OpenCode's control. A project voice overrides the matching seed without
changing the installed bundle.

See the [shared guide](../agents/README.md) for safe updates and npm installation
after publication. Official source: [OpenCode Agent Skills](https://opencode.ai/docs/skills/).
