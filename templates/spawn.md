---
description: Spawn a new tentacle in the current team
---

# Spawn tentacle

Arguments: `$ARGUMENTS` — expected format `<name> <cwd> <prompt...>`.

Parse `$ARGUMENTS`:
- **First whitespace-delimited token**: tentacle name (must match `^[a-z][a-z0-9-]{1,30}$`)
- **Second whitespace-delimited token**: working directory — an absolute path
- **Everything after the second token**: the spawn prompt, preserved as-is (newlines in the prompt arrive as literal characters — keep them)

## Team resolution

The team name comes from the session env (`$OCTOPUS_TEAM`, set by
`parachute-octopus launch`). Resolve it with a quick Bash:

```
echo $OCTOPUS_TEAM
```

Use whatever comes back as `<team>`. If it's empty, fall back to `octopus`
(the legacy default) and mention the miss in your acknowledgement so Aaron
can re-launch with the right team next time.

**Do not omit `team_name` from the Agent call.** Without it, the Agent tool
falls back to an auto-generated UUID-keyed team per parent session — the
tentacle joins that ghost team instead of `<team>`, and becomes invisible
to the dashboard and the team-lead's inbox. This is the bug that used to
silently swallow reports.

## Validate

1. Name matches the regex above
2. `cwd` is an absolute path that exists and is a directory (quick Bash to confirm)
3. The team config exists at `~/.claude/teams/<team>/config.json` (project-local
   `<repo>/.claude/teams/<team>/config.json` also fine). If missing, ask Aaron
   to create it with `TeamCreate({team_name: "<team>", ...})` first — don't
   try to spawn into a non-existent team.
4. Name is not already present in that team's `config.json`

If any check fails, explain what's wrong briefly and stop.

## Spawn

If all checks pass, invoke:

```
Agent({
  subagent_type: "tentacle",
  name: <name>,
  team_name: "<team>",        // REQUIRED — from $OCTOPUS_TEAM
  prompt: "Working directory: <cwd>\n\n<the spawn prompt>"
})
```

The Agent runtime creates the tmux pane, registers the tentacle in
`~/.claude/teams/<team>/config.json` with a `tmuxPaneId`, and gives the new
session the full team-messaging tool surface (`SendMessage`, inbox, etc.).
The dashboard picks it up on its next 2s poll.

## Acknowledge

Then acknowledge with one short line:

```
Spawned `<name>` in `<cwd>` (team: <team>).
```

Nothing more.

## Optional: explicit team override

If Aaron wants to spawn into a *different* team than `$OCTOPUS_TEAM` (rare —
cross-team dispatch), accept that as an out-of-band instruction and pass
that team name as `team_name` instead. Announce the override in the
acknowledgement.
