# Octopus

This project uses [parachute-octopus](https://github.com/ParachuteComputer/parachute-octopus) for team coordination.

- `/spawn <name> <cwd> <prompt>` — spin up a tentacle for focused work
- `/report <headline>` — tentacles report back to the team-lead
- The web dashboard shows all active tentacles and their status

Tentacles read their working directory's `CLAUDE.md` on spawn — it is not auto-loaded.
