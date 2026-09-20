Save the process we just used as a skill called Cadence.

When to use it: the user asks to write, recast, de-slop, or score prose, or to match a Cadence voice such as essence or punchy.

Required access: Node 18 or newer on this computer, and the Cadence files at /workspace/Cadence.

Sequence:
1. Read /workspace/Cadence/AGENTS.md if present, otherwise /workspace/Cadence/skills/cadence/AGENTS.md, and the requested voice in /workspace/Cadence/voices/<name>.md. List those files when asked which voices exist. Do not invent a name.
2. Score with: node /workspace/Cadence/skills/cadence/scripts/deslop.mjs --prose-only --json <file>
3. Edit only the prose. Preserve facts, heading levels, links, code fences, tables, and layout.
4. Score again with the same flags.
5. Report the real before/after score and grade, the voice used, and which named tells remain.

If Node is missing or the detector fails, say verification did not run. Never invent a score. Never send, publish, or change production files without approval.
