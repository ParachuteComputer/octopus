# Octopus team layer

This repo uses [parachute-octopus](https://github.com/ParachuteComputer/parachute-octopus) — a
team layer for Claude Code that lets the primary session (the **team-lead**)
spawn focused **tentacles** in dedicated panes for parallel work.

## How it works

- The team-lead session runs in a tmux session and holds the conversation.
- `/spawn <name> <cwd> <prompt>` (slash command) creates a tentacle teammate
  pinned to a working directory. The tentacle reads its cwd's `CLAUDE.md`
  before doing any work.
- `/report <headline>` (slash command, invoked *by* a tentacle) sends a
  structured summary back to the team-lead.
- `parachute-octopus ui` opens a web dashboard for observing every live pane and
  sending keystrokes from a browser / tablet.

## Tentacle conventions

Tentacles in this repo follow `.claude/agents/tentacle.md`:

- Read the working directory's `CLAUDE.md` first — it is **not** auto-loaded.
- One logical change per commit. Tests + static analysis between edits.
- Self-review via the nested `reviewer` subagent before reporting back.
- Never auto-merge PRs. The team-lead surfaces them; the human decides.

## What lives where

- `.claude/commands/spawn.md` — the `/spawn` slash command (team-lead invokes)
- `.claude/commands/report.md` — the `/report` slash command (tentacles invoke)
- `.claude/agents/tentacle.md` — the tentacle agent definition
- `.claude/agents/reviewer.md` — the fresh-eyes code reviewer subagent

These files are written by `parachute-octopus init` and updated by re-running it.
