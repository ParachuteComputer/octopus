# parachute-octopus — deprecated 2026-06-14

## Why this module is deprecated

parachute-octopus shipped a "team layer for Claude Code" — a central team-lead
session that spawns **tentacles** (Claude Code teammates) into tmux panes, pins
each to a working directory, observes them through a web dashboard, and lets you
type into any pane from a browser over Tailscale. The roster lived in a config
file; the dashboard reconciled it against live tmux panes; sending input was
tmux `send-keys` behind a key allowlist.

In practice that approach hit its limits:

- **The native-team spawn path is fragile.** tmux pane spawning, roster↔live
  reconciliation, and `send-keys` injection are brittle to coordinate —
  slot-squatting after a restart, `isActive` not being a reliable death signal,
  orphan-pane races when a one-shot crosses a persistent agent, and
  `/resume`-kills. The cross-team failure-mode catalog we built up (README +
  templates/reviewer.md) documents these; they're inherent to driving Claude
  through a shared terminal multiplexer rather than a typed control surface.

- **There is no security boundary.** A tentacle runs with the operator's full
  ambient authority — same filesystem, same network, same credentials. That is
  fine for a trusted owner-operator at a keyboard, but it doesn't generalize to
  scoped, woken, or remotely-triggered sessions.

- **A typed control surface does the job better.** The channel sandboxed
  agent-sessions work replaces the fragile tmux-native spawn path with an
  **attenuated MCP spawn-face**: each session is sandboxed (Seatbelt/bubblewrap),
  egress-restricted, and handed exactly the per-resource hub-minted tokens its
  spec declares — nothing more. The same "type into a live pane from a browser"
  affordance survives as the in-page terminal (operator-gated on `channel:admin`,
  over the WS bridge), but the spawn + scope + observe loop is now a typed
  protocol, not `send-keys` against a shared tmux server.

## What was harvested

The useful primitives carried forward into the channel work:

- **Pod registry** (`src/pod.ts`) → the agent-spec + per-session registry shape.
- **Roster ↔ live reconciliation** → the spawn idempotency + session-existence
  probe (`spawnAgent` no-ops on an existing session).
- **`send-keys` + the key allowlist** → the in-page terminal's control-frame
  surface over the WS bridge (input is now an explicit, authorized channel, not
  raw keystroke injection).
- **The cross-team failure-mode catalog** → informed the design's threat model
  and the operator-gated terminal scope.

## Migration

### If you want to spawn + observe scoped Claude sessions

Use the channel sandboxed agent-sessions instead. Each session is sandboxed,
egress-restricted, and scoped to exactly the channels + vault its spec declares,
with an in-page terminal for live attach.

- Design doc: [`parachute-channel/design/2026-06-14-sandboxed-agent-sessions.md`](https://github.com/ParachuteComputer/parachute-channel/blob/main/design/2026-06-14-sandboxed-agent-sessions.md)
  (channel#47).
- Phase 1 PRs (parachute-channel): #48 (core — sandbox adapter + agent-spec +
  spawn/scope), #49 (full-tier deploy), #50 (per-channel Claude OAuth secret
  storage), #51 (in-page terminal). The integration PR lands all four together.

### If you just want a personal multi-pane Claude workflow at your own keyboard

You can keep using octopus — nothing has been unpublished, and existing installs
continue to work. It remains the simplest "team-lead + tentacles in tmux panes"
harness for a single trusted operator. Expect no new features.

## Status

- No new features. Bugfixes only.
- npm deprecate warning on install (after Aaron runs the command below).
- Existing installs continue working. Nothing has been unpublished. Roll back to
  a specific version if needed.

The deprecation command (for Aaron — copy-paste, kept short so npm install
doesn't wrap awkwardly):

```bash
npm deprecate @openparachute/octopus "Deprecated 2026-06-14. Superseded by parachute-channel sandboxed agent sessions. See repo DEPRECATED.md"
```

- `@latest` tag maintained for now.

## Questions / issues

File at https://github.com/ParachuteComputer/parachute-octopus/issues — Aaron
will respond.
