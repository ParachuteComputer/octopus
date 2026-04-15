---
description: Spawn a new tentacle in the octopus team
---

# Spawn tentacle

Arguments: `$ARGUMENTS` — expected format `<name> <cwd> <prompt...>`.

Parse `$ARGUMENTS`:
- **First whitespace-delimited token**: tentacle name (must match `^[a-z][a-z0-9-]{1,30}$`)
- **Second whitespace-delimited token**: working directory — an absolute path
- **Everything after the second token**: the spawn prompt, preserved as-is (newlines in the prompt arrive as literal characters — keep them)

Validate:
1. Name matches the regex above
2. `cwd` is an absolute path that exists and is a directory (quick Bash to confirm)
3. Name is not already present in the team config. Check
   `<repo>/.claude/teams/<team>/config.json` first (project-local), falling back
   to `~/.claude/teams/<team>/config.json` (home-dir). Default `<team>` is
   `octopus`; use whatever team name this session was launched with.

If any check fails, explain what's wrong briefly and stop.

If all checks pass:

```
Agent({
  subagent_type: "tentacle",
  name: <name>,
  team_name: <team>,           // usually "octopus"
  prompt: "Working directory: <cwd>\n\n<the spawn prompt>"
})
```

Then acknowledge: `Spawned \`<name>\` in \`<cwd>\`.` — one short line, nothing more.
