# Octopus

This project uses [parachute-octopus](https://github.com/ParachuteComputer/parachute-octopus) for team coordination.

- `/spawn <name> <cwd> <prompt>` — spin up a tentacle for focused work
- `/report <headline>` — tentacles report back to the team-lead
- The web dashboard shows all active tentacles and their status

Tentacles read their working directory's `CLAUDE.md` on spawn — it is not auto-loaded.

## Where reports land

Tentacles have two backends with different delivery paths:

- **tmux-backed tentacles** deliver reports via `SendMessage` into the team-lead's inbox. Check the inbox / dashboard as usual.
- **Agent-backed subagents** (spawned via the `Agent` tool) cannot `SendMessage`. Their report is returned as the subagent's **final assistant message** — you'll see it inline in the `Agent` tool's completion result, not in the inbox. Read the completion payload to get the report.

If you spawn an Agent-backed tentacle and nothing shows up in the inbox, that's expected — look at the `Agent` call's return value for the report.
