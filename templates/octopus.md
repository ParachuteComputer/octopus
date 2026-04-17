# Octopus

This project uses [parachute-octopus](https://github.com/ParachuteComputer/parachute-octopus) for team coordination.

- `/spawn <name> <cwd> <prompt>` — spin up a tentacle for focused work
- `/report <headline>` — tentacles report back to the team-lead
- The web dashboard shows all active tentacles and their status

Default pattern: **one long-lasting tentacle per repo**, named after the repo (`vault`, `daily`, `octopus`, …). Before spawning a new one, check whether a tentacle for the target repo already exists — if so, send the task there instead.

Tentacles read their working directory's `CLAUDE.md` on spawn — it is not auto-loaded.
