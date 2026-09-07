# Cadence in ZCode

This target installs a skill for **ZCode Agent**, the built-in agent. It works with
the model you select there, including GLM-5.3 when your provider makes it available.
If you run a separate CLI inside ZCode, use that CLI's Cadence install target instead.

From this checkout:

```bash
npm run install:zcode
```

This writes `~/.zcode/skills/cadence/`. In ZCode, open **Settings → Skills**, click
**Refresh**, and enable Cadence. Select it with `$cadence`, then give the task:

```text
$cadence recast README.md in the essence voice and report before/after scores.
```

ZCode's official guide specifies the user-level path, but does not specify a
project filesystem path. This installer therefore rejects `--project` for ZCode
rather than guessing. For a project-only skill, use **Settings → Skills → Import**
to import an existing Cadence skill from a supported external agent, choose
**Copy**, and select the **Project** target. Import the whole directory so the
profiles and scripts remain available. Confirm the source and enable switch.

Node 18 or newer and file/shell tools must be available in the agent environment.
For remote workspaces, use ZCode's skill-sync workflow and ensure Node is present
on the remote host. Local installation alone does not deploy to a remote machine.

Cadence does not configure Z.ai endpoints, API keys, subscriptions, or approvals.
Keep your working provider setup; an unsupported model/provider connection is not
fixed by installing a writing skill.

See the [shared guide](../agents/README.md) for portable builds and updates.
Official references: [Skills](https://zcode.z.ai/en/docs/skill) and
[Connect Models](https://zcode.z.ai/en/docs/configuration).
