---
description: Spawn a new tentacle in the current team
---

# Spawn tentacle

Arguments: `$ARGUMENTS` — expected format `<name> <cwd> <prompt...>`.

## Preferred pattern: one tentacle per repo

Before spawning, check whether a tentacle for this repo already exists
in the team config. The default convention is **one long-lasting tentacle
per repo, named after the repo** (`vault`, `daily`, `octopus`, …). If one
exists, send the task to that tentacle instead of spawning a new one —
its context for the repo is already loaded.

Spawn a fresh tentacle when:

- No tentacle exists for this repo yet
- The task is genuinely one-off and scoped outside any single repo

Name the new tentacle after its repo (directory basename of `<cwd>`) unless
the caller has explicitly chosen a different name.

Parse `$ARGUMENTS`:
- **First whitespace-delimited token**: tentacle name (must match `^[a-z][a-z0-9-]{1,30}$`)
- **Second whitespace-delimited token**: working directory — an absolute path
- **Everything after the second token**: the spawn prompt, preserved as-is (newlines in the prompt arrive as literal characters — keep them)

Validate:
1. Name matches the regex above
2. `cwd` is an absolute path that exists and is a directory (quick Bash to confirm)
3. Name is not already present in the team config. The team name is the value
   of `$OCTOPUS_TEAM` for this session (check with `echo $OCTOPUS_TEAM`). Look
   at `<repo>/.claude/teams/<team>/config.json` first (project-local), falling
   back to `~/.claude/teams/<team>/config.json` (home-dir).

If any check fails, explain what's wrong briefly and stop.

If all checks pass:

```
Agent({
  subagent_type: "tentacle",
  name: <name>,
  // Omit team_name — the Agent tool uses the current session's team context
  // (from $OCTOPUS_TEAM). Only pass team_name to spawn into a different team.
  prompt: "Working directory: <cwd>\n\n<the spawn prompt>"
})
```

Then acknowledge: `Spawned \`<name>\` in \`<cwd>\`.` — one short line, nothing more.
