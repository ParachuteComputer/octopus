export function runHelp(command?: string): void {
  if (command === "launch") return helpLaunch();
  if (command === "ui") return helpUi();
  if (command === "pod") return helpPod();
  if (command === "env") return helpEnv();
  console.log(`parachute-octopus — team layer for Claude Code

commands:
  launch [name]   start tmux session with team-lead + web dashboard
  ui              start / stop / restart the web dashboard
  pod             manage multiple octopus instances
  send <text>     send keystrokes to the team-lead pane
  sessions        list recent Claude Code sessions for resume

  init            bootstrap octopus in the current repo
  spawn <n> <d>   type /spawn into the team-lead pane
  help <command>  detailed help (launch, ui, pod, env)

https://github.com/ParachuteComputer/parachute-octopus
`);
}

function helpLaunch(): void {
  console.log(`parachute-octopus launch [<name>] — start tmux + claude code as team-lead

  parachute-octopus launch parachute    look up scope + team from pod registry
  parachute-octopus launch              infer from cwd if registered, else defaults

  --team <name>           team name (default: inferred from pod or "octopus")
  --cwd <path>            working directory (default: $PWD)
  --session <name>        tmux session name (default: team name)
  --model <id>            claude model override
  --no-skip-permissions   don't pass --dangerously-skip-permissions
  --no-ui                 skip starting the web dashboard
  --ui-port <n>           dashboard port (default: 6061)
  --ui-host <addr>        dashboard bind address (default: 0.0.0.0)
  --continue              resume the most recent Claude Code session
  --resume <session-id>   resume a specific session (see: sessions)
`);
}

function helpUi(): void {
  console.log(`parachute-octopus ui — web dashboard lifecycle

  parachute-octopus ui              start (daemonizes by default)
  parachute-octopus ui stop         stop the running dashboard
  parachute-octopus ui restart      stop + start with new flags
  parachute-octopus ui status       show pid, url, mode

flags:
  --host <addr>           bind address (default: 0.0.0.0)
  --port <n>              port (default: 6061)
  --team <name>           team name (default: octopus)
  --team-config <path>    explicit config.json path
  --foreground            run attached to terminal (don't daemonize)
  --poll-ms <n>           snapshot interval in ms (default: 2000)
`);
}

function helpPod(): void {
  console.log(`parachute-octopus pod — manage multiple octopus instances

  parachute-octopus pod                           list all octopi + running status
  parachute-octopus pod add <name> [--scope dir]  register an octopus (default scope: cwd)
  parachute-octopus pod remove <name>             unregister (files left untouched)

Once registered, launch by name:
  parachute-octopus launch parachute              resolves scope + team from the pod

Or launch from any registered scope directory — the pod is inferred:
  cd ~/ParachuteComputer && parachute-octopus launch

Pod file: ~/.config/octopus/pod.json
UI shows tabs when the pod has 2+ octopi.
`);
}

function helpEnv(): void {
  console.log(`parachute-octopus — environment variables

  OCTOPUS_TEAM            default team name (default: octopus)
  OCTOPUS_TEAM_CONFIG     absolute path to config.json (skips lookup)
  OCTOPUS_TMUX_SESSION    tmux session to filter pane scans to (set by
                          \`octopus launch\`/\`octopus ui --tmux-session\`)
  OCTOPUS_UI_PORT         dashboard port (default: 6061)
  OCTOPUS_UI_HOST         dashboard bind address (default: 0.0.0.0)
  OCTOPUS_UI_POLL_MS      snapshot interval in ms (default: 2000)
  OCTOPUS_SPAWN_TARGETS   colon-separated paths for spawn cwd suggestions
  XDG_STATE_HOME          pid file + log dir (default: ~/.local/state)
`);
}
