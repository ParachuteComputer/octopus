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

  launch [--team <name>] [--cwd <path>] [--session <name>] [--model <id>] [--no-skip-permissions]
         [--continue | --resume <session-id>]
      Start (or attach to) a tmux session running Claude Code as the team-lead.
      Defaults: team "octopus", cwd "$PWD", session = team name. Passes
      --dangerously-skip-permissions to claude by default; opt out with
      --no-skip-permissions or OCTOPUS_SKIP_PERMISSIONS=false.
      Pass --continue to resume the most recent Claude Code session for the
      cwd, or --resume <session-id> for a specific one. (Mutually exclusive;
      ignored if a tmux session is already running for this team.)

  sessions [--cwd <path>]
      List recent Claude Code sessions for the current cwd so you can pick
      one to resume. Reads ~/.claude/projects/<cwd-encoded>/*.jsonl and
      prints the id, last-touched time, and approximate duration of each.

  ui [--team <name>] [--port 6061] [--host 127.0.0.1]
      Start the web dashboard. Loopback by default; pass --host 0.0.0.0 to
      expose it on the LAN / Tailscale.

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
  OCTOPUS_UI_HOST         UI bind host (default 127.0.0.1)
  OCTOPUS_UI_POLL_MS      Snapshot interval in ms (default 2000)
  OCTOPUS_SPAWN_TARGETS   Colon-separated absolute paths for spawn datalist

Learn more: https://github.com/ParachuteComputer/octopus
`);
}
