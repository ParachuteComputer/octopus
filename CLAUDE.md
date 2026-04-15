# octopus

This repo IS the octopus team layer. Tentacles working in this repo are
helping develop the harness that other repos use.

## Layout

```
src/
  cli.ts              CLI entry — dispatches to subcommands
  cli/
    help.ts           `octopus help`
    init.ts           `octopus init` — bootstraps a target repo
    launch.ts         `octopus launch` — start tmux + Claude Code as team-lead
    ui.ts             `octopus ui` — start the web dashboard
    send.ts           `octopus send` — tmux send-keys to the team-lead
    spawn.ts          `octopus spawn` — type /spawn into the team-lead
    flags.ts          tiny long-flag parser
    tmux.ts           thin tmux helpers for CLI subcommands
  config.ts           re-exports for team config loading
  paths.ts            path resolution: team config, public/, templates/
  ui/                 the web dashboard (Hono + SSE on Bun)
    server.tsx        Hono app + SSE streams + POST send/spawn/shutdown
    state.ts          load config, build snapshot, derive status
    tmux.ts           tmux capture-pane / send-keys / list-panes
    render.tsx        JSX components: DashboardPage, PanePage
    colors.ts         tentacle color palette
    format.ts         relative-time formatting
templates/            files written into target repos by `octopus init`
public/               static assets served by the UI (CSS + JS)
tests/                bun test suite
```

## Conventions

- **Bun-native.** No bundler, no build step. The bin runs `.ts` directly via
  `#!/usr/bin/env bun`. Tests are `bun test`.
- **Loopback by default.** The web UI binds `127.0.0.1` unless `--host` /
  `OCTOPUS_UI_HOST` says otherwise. The dashboard shells `tmux send-keys`
  into every pane on the box — network-layer gating is the auth.
- **Templates are the contract.** Files under `templates/` are written
  verbatim into target repos by `octopus init`. When the slash command or
  agent definitions evolve, update the template file directly — don't
  re-author from scratch.
- **No Parachute Vault dependency.** Octopus is the team layer — it must
  work standalone. Vault, Daily, Agents, etc. are optional composers.
- **Feature branches always.** Open a PR; never commit to main.

## Tests

```
bun test
```

The suite exercises every route wire (smoke), the snapshot derivation logic
(state), the path-resolution priority chain (paths), and the `init` template
writer (init).

## Running locally during development

```
bun src/cli.ts ui          # dashboard at http://127.0.0.1:6061
bun src/cli.ts init        # bootstrap a target repo
bun src/cli.ts launch      # tmux + Claude Code as team-lead
```

For UI development with hot-reload:

```
bun --hot src/cli.ts ui
```
