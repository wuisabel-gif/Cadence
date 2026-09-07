# Cadence in Kimi Code CLI

Use Cadence with the model already selected in Kimi Code CLI, including Kimi K3
when available to your account. No model ID or credential is installed by Cadence.

From this checkout:

```bash
npm run install:kimi
# Or install only in one repository:
npm run install:kimi -- --project /path/to/project
```

The default user path is `~/.kimi-code/skills/cadence/`. If `KIMI_CODE_HOME` is set,
the installer uses `<KIMI_CODE_HOME>/skills/cadence/` instead. Project installs use
`<project>/.kimi-code/skills/cadence/`. Start a new session, then ask:

```text
/skill:cadence recast README.md in the essence voice and verify the edit.
Use Cadence to score this draft without changing it.
```

The installed folder contains the voice profiles and a Node-based detector. Node
18 or newer must be available in Kimi's execution environment even though the
current Kimi CLI itself does not require Node. If shell access is denied, Cadence
must report that verification did not run, not invent a score.

This target follows the **current `kimi-code` client**. Older Python `kimi-cli`
versions use different native directories. Check the documentation linked by
`kimi --help` before installing. For a legacy client or a custom skills directory,
use `cadence-install-skill --agent kimi --dest <actual-skill-directory>` and verify
that your client discovers that directory. The installer does not migrate Kimi
configuration or sessions.

See the [shared guide](../agents/README.md) for updates, npm installation after
publication, project voice overrides, and safety limits.

For a developer smoke check with the current Kimi Code CLI installed:

```bash
npm run check:kimi
```

It starts an authenticated loopback server with temporary home/configuration
directories and reads the session-less skill catalog for two test workspaces.
It checks user and project discovery, then removes only its temporary files.
It does not configure a provider, send a model prompt, or print the local bearer
token. This check targets the current `kimi-code` server API, not the legacy client.

Sources: [current Kimi Code skills](https://moonshotai.github.io/kimi-code/en/customization/skills.html),
[legacy kimi-cli skills](https://moonshotai.github.io/kimi-cli/en/customization/skills.html).
