export function runHelp(command?: string): void {
  if (command === "launch") return helpLaunch();
  if (command === "ui") return helpUi();
  if (command === "env") return helpEnv();
  console.log(`octopus — team layer for Claude Code

commands:
  launch          start tmux session with team-lead + web dashboard
  ui              start / stop / restart the web dashboard
  send <text>     send keystrokes to the team-lead pane

  init            bootstrap octopus in the current repo
  spawn <n> <d>   type /spawn into the team-lead pane
  help <command>  detailed help (launch, ui, env)

https://github.com/ParachuteComputer/octopus
`);
}

function helpLaunch(): void {
  console.log(`octopus launch — start tmux + claude code as team-lead

  --team <name>           team name (default: octopus)
  --cwd <path>            working directory (default: $PWD)
  --session <name>        tmux session name (default: team name)
  --model <id>            claude model override
  --no-skip-permissions   don't pass --dangerously-skip-permissions
  --no-ui                 skip starting the web dashboard
  --ui-port <n>           dashboard port (default: 6061)
  --ui-host <addr>        dashboard bind address (default: 0.0.0.0)
`);
}

function helpUi(): void {
  console.log(`octopus ui — web dashboard lifecycle

  octopus ui              start (daemonizes by default)
  octopus ui stop         stop the running dashboard
  octopus ui restart      stop + start with new flags
  octopus ui status       show pid, url, mode

flags:
  --host <addr>           bind address (default: 0.0.0.0)
  --port <n>              port (default: 6061)
  --team <name>           team name (default: octopus)
  --team-config <path>    explicit config.json path
  --foreground            run attached to terminal (don't daemonize)
  --poll-ms <n>           snapshot interval in ms (default: 2000)
`);
}

function helpEnv(): void {
  console.log(`octopus — environment variables

  OCTOPUS_TEAM            default team name (default: octopus)
  OCTOPUS_TEAM_CONFIG     absolute path to config.json (skips lookup)
  OCTOPUS_UI_PORT         dashboard port (default: 6061)
  OCTOPUS_UI_HOST         dashboard bind address (default: 0.0.0.0)
  OCTOPUS_UI_POLL_MS      snapshot interval in ms (default: 2000)
  OCTOPUS_SPAWN_TARGETS   colon-separated paths for spawn cwd suggestions
  XDG_STATE_HOME          pid file + log dir (default: ~/.local/state)
`);
}
