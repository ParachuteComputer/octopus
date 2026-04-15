# octopus

A team layer for [Claude Code](https://docs.claude.com/claude-code) — spawn,
observe, and coordinate **tentacles** (Claude Code teammates) in any repo.

One central session — the **team-lead** — holds the conversation. From there,
focused tentacles get spawned into their own tmux panes and pinned to a
working directory. Each tentacle reads its `CLAUDE.md`, does the focused
work, self-reviews, and reports back. The team-lead stays at the
big-picture level; depth happens in parallel.

A small, dark web dashboard shows every live pane at a glance and lets you
type into any of them from a browser or tablet over Tailscale.

> Octopus is one piece of the [Parachute](https://github.com/ParachuteComputer)
> family. It is **standalone by design** — no Vault, no agents service, no
> external dependencies beyond `tmux` + `claude` + `bun`.

## Install

```bash
bun add -g @openparachute/octopus
```

You'll need [`bun`](https://bun.com), [`tmux`](https://github.com/tmux/tmux),
and the [Claude Code CLI](https://docs.claude.com/claude-code) on PATH.

## Quick start

From the root of any repo:

```bash
octopus init        # writes .claude/commands + agents + octopus.md
octopus launch      # starts tmux + Claude Code as the team-lead
octopus ui          # opens the web dashboard at http://127.0.0.1:6061
```

The team-lead is now ready. Type `/spawn <name> <cwd> <prompt>` in its pane
to spin up a tentacle, or use the **🐙 spawn** button in the dashboard.

## How it works

```
┌─────────────────────────────────────────────────────────┐
│  team-lead (primary Claude Code session, in tmux)       │
│  – holds the conversation                               │
│  – dispatches `/spawn` to create tentacles              │
│  – receives `/report` summaries from tentacles          │
└─────────────────┬───────────────────────────────────────┘
                  │ Agent({ subagent_type: "tentacle", … })
                  ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ tentacle │ │ tentacle │ │ tentacle │   each in its own
│ pane #1  │ │ pane #2  │ │ pane #N  │   tmux pane, pinned
└──────────┘ └──────────┘ └──────────┘   to a working dir

┌─────────────────────────────────────────────────────────┐
│  octopus ui  →  http://127.0.0.1:6061                   │
│  – live grid of every pane                              │
│  – click any card to expand scrollback + send keys      │
│  – spawn / shutdown tentacles from the browser          │
└─────────────────────────────────────────────────────────┘
```

The team config (`config.json`) is the source of truth for the roster. The
dashboard reads it, reconciles against live tmux panes by name, and pushes
SSE updates every 2s.

## CLI reference

### `octopus init [--team <name>] [--cwd <path>]`

Bootstrap the current repo. Writes:

- `.claude/commands/spawn.md` — `/spawn` slash command
- `.claude/commands/report.md` — `/report` slash command
- `.claude/agents/tentacle.md` — tentacle agent definition
- `.claude/agents/reviewer.md` — fresh-eyes code reviewer
- `.claude/octopus.md` — short conventions snippet linked from `CLAUDE.md`

Idempotent: re-running overwrites the four template files but preserves the
rest of `CLAUDE.md`. Default team name is `octopus`.

### `octopus launch [--team <name>] [--cwd <path>] [--session <name>] [--model <id>]`

Start (or attach to) a tmux session running Claude Code as the team-lead.
Defaults: team `octopus`, cwd `$PWD`, session name = team name. Inside an
existing tmux session it does `switch-client` instead of `attach`.

### `octopus ui [--team <name>] [--port 6061] [--host 127.0.0.1] [--team-config <path>]`

Start the web dashboard. Loopback only by default. Opt into LAN/Tailscale
exposure with `--host 0.0.0.0`. The team config path is resolved from:

1. `--team-config` flag (or `OCTOPUS_TEAM_CONFIG` env)
2. `<cwd>/.claude/teams/<team>/config.json` (project-local)
3. `~/.claude/teams/<team>/config.json` (home-dir, Claude Code default)

### `octopus send <text...> [--session <name>]`

Send keystrokes to the team-lead's tmux session. Useful for slash commands
or status pings from a script.

```bash
octopus send /compact
octopus send "check the deploy status"
```

### `octopus spawn <name> <cwd> <prompt...> [--session <name>]`

Convenience for typing `/spawn <name> <cwd> <prompt>` into the team-lead's
pane from a terminal. The `octopus ui` spawn modal does the same thing.

## Web dashboard

The dashboard lays the team out as an octopus: the **team-lead is the head**
at the top, **tentacles are the arms** in the grid below. Each card shows
status (`idle` / `working` / `dead`), the live pane id, recent output, and
an **open** link that expands the scrollback with a send-keys input and
useful key controls (`Esc`, `Tab`, `Shift+Tab`, arrows, `/compact`, etc.).

Real-time via Server-Sent Events polling tmux every 2s. SSR-first — `curl /`
gives a readable dashboard with no JS.

### API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET`  | `/api/state`            | Full snapshot |
| `GET`  | `/api/stream`           | SSE — snapshot every 2s |
| `GET`  | `/api/pane/:name`       | One-shot scrollback |
| `GET`  | `/api/stream/pane/:name`| SSE — pane scrollback every 2s |
| `POST` | `/api/panes/:name/send` | tmux send-keys (text or key mode) |
| `POST` | `/api/spawn`            | Type `/spawn …` into the team-lead |
| `POST` | `/api/shutdown/:name`   | Send `/exit` to a tentacle |
| `GET`  | `/api/spawn-targets`    | Datalist suggestions for the spawn modal |

## Auth

**None at the app layer.** This server shells `tmux send-keys` into every
pane on the box — it is *intentionally* gated at the network layer, not the
app layer. Bind it to localhost or a Tailscale-only interface and rely on
network ACLs. Do not expose it on the open internet.

## Where octopus sits in the Parachute family

Octopus is one piece of [Parachute](https://github.com/ParachuteComputer):
small things, loosely joined.

- **[parachute-vault](https://github.com/ParachuteComputer/parachute-vault)** —
  durable knowledge graph. Optional. If present, your tentacles can persist
  reports as `uni/handoff` notes.
- **[parachute-agents](https://github.com/ParachuteComputer/parachute-agents)** —
  hosted agent runtime. Optional. Octopus tentacles run *in your terminal* via
  Claude Code; agents service runs them remotely.
- **[@openparachute/cli](https://github.com/ParachuteComputer/openparachute-cli)** —
  umbrella `parachute` command that dispatches to any `parachute-*` binary on
  PATH. Octopus ships `parachute-octopus` for that pattern; both `octopus`
  and `parachute octopus …` work.

Each piece stands alone. Compose what you want, leave the rest.

## Contributing

- Conventions live in
  [parachute-patterns](https://github.com/ParachuteComputer/parachute-patterns).
  Cross-module changes (naming, brand, schemas) start there.
- Feature branches → PR → review → merge. No direct commits to `main`.
- Bun-native: no bundler, no build step. Tests are `bun test`.

## License

AGPL-3.0-or-later. Same as the rest of the Parachute family.
