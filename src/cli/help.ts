export function runHelp(): void {
  console.log(`octopus — team layer for Claude Code

A spawn / observe / coordinate harness for Claude Code teammates ("tentacles")
in any repo. One central session (the team-lead) holds the conversation;
tentacles do the focused work in their own panes.

Commands:
  init [--team <name>]
      Bootstrap the current repo: writes the spawn/report slash commands and
      the tentacle/reviewer agent definitions into .claude/, and ensures
      CLAUDE.md links the octopus conventions snippet.

  launch [--team <name>] [--cwd <path>] [--session <name>] [--model <id>]
         [--no-skip-permissions] [--no-ui] [--ui-port <n>] [--ui-host <addr>]
      Start (or attach to) a tmux session running Claude Code as the team-lead.
      By default ALSO spawns the web UI as a managed window in the same tmux
      session — one lifecycle, no orphan processes. Pass --no-ui to skip.
      Defaults: team "octopus", cwd "$PWD", session = team name. Passes
      --dangerously-skip-permissions to claude by default; opt out with
      --no-skip-permissions or OCTOPUS_SKIP_PERMISSIONS=false.

  ui [--team <name>] [--port 6061] [--host 0.0.0.0] [--foreground]
      Start the web dashboard. Daemonizes by default (logs to
      ~/.local/state/octopus/ui.log). Idempotent — if already running, prints
      the URL and exits 0. Pass --foreground to run attached to the terminal.
      Default host is 0.0.0.0 (gate at the network layer — Tailscale, firewall).

  ui stop [--timeout <ms>]
      SIGTERM the running UI, wait for clean exit, remove PID file. Refuses
      to kill if the recorded PID belongs to a non-octopus process.

  ui restart [<ui flags>]
      Stop, then start with the given flags.

  ui status
      Print PID, URL, mode (tmux / daemon / foreground), and PID-file path.

  send <text...> [--session <name>]
      Send keystrokes to the team-lead's tmux session via tmux send-keys.

  spawn <name> <cwd> <prompt...> [--session <name>]
      Type \`/spawn <name> <cwd> <prompt>\` into the team-lead's pane.
      Convenience for firing the slash command from a terminal.

  help, --help, -h     Show this help
  version, --version   Show version

Environment:
  OCTOPUS_TEAM            Override default team name ("octopus")
  OCTOPUS_TEAM_CONFIG     Absolute path to a team config.json (skips lookup)
  OCTOPUS_UI_PORT         UI port (default 6061)
  OCTOPUS_UI_HOST         UI bind host (default 0.0.0.0)
  OCTOPUS_UI_POLL_MS      Snapshot interval in ms (default 2000)
  OCTOPUS_SPAWN_TARGETS   Colon-separated absolute paths for spawn datalist
  XDG_STATE_HOME          PID file + log dir (defaults to ~/.local/state)

Learn more: https://github.com/ParachuteComputer/octopus
`);
}
