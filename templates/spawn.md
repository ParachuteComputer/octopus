---
description: Spawn a new tentacle in the octopus team
---

# Spawn tentacle

Arguments: `$ARGUMENTS` — expected format `<name> <cwd> <prompt...>`.

Parse `$ARGUMENTS`:
- **First whitespace-delimited token**: tentacle name (must match `^[a-z][a-z0-9-]{1,30}$`)
- **Second whitespace-delimited token**: working directory — an absolute path, or a shortname that should resolve under `~/UnforcedAGI/Code/ParachuteComputer/` or `~/UnforcedAGI/Cowork/`
- **Everything after the second token**: the spawn prompt, preserved as-is (newlines in the prompt arrive as literal characters — keep them)

Validate:
1. Name matches the regex above
2. `cwd` exists and is a directory (check with a quick Bash)
3. Name is not already present in `~/.claude/teams/octopus/config.json`

If any check fails, explain what's wrong to Aaron briefly and stop.

If all checks pass:

```
Agent({
  subagent_type: "tentacle",
  name: <name>,
  team_name: "octopus",
  prompt: "Working directory: <cwd>\n\n<the spawn prompt>"
})
```

Then acknowledge to Aaron: `Spawned \`<name>\` in \`<cwd>\`.` — one short line, nothing more.
