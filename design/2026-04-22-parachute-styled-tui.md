# Parachute-styled UI over tmux — RFC

**Status:** Draft
**Author:** octopus tentacle (audit session, 2026-04-22)
**Ask:** post-launch design direction; not scheduled

## Context

Octopus today ships a functional SSR dashboard (`src/ui/server.tsx`) that renders
a snapshot of every tmux pane in the team, updating via SSE every two seconds.
It works — and its `curl /`-readable fallback is genuinely nice — but the
render is a polled capture, not a real terminal. Users still fall back to
`tmux attach` or Claude Code Remote Control (CCRC) when they want to interact.

CCRC is the shipped baseline. It's functional but spartan: plain terminal
chrome, no tentacle-level model, no Parachute visual language.

Aaron wants the next version of the octopus UI to hit the polish level of the
Lens PWA — real typography, real design system, real affordances — while
staying a terminal at the core. Direct type-into-pane remains first-class;
this is Parachute polish *around* tmux, not a replacement.

This RFC is the design anchor for that work. It's an extension of the
already-filed ticket at #20, captured here as a persistent repo-native doc.

## Goals

1. **Strictly better than CCRC** on day one — if we ship it, no one should
   reach for CCRC for the common cases.
2. **Parachute visual language** — colors, typography, spacing that match
   Lens and the site. Not a skin; a real design pass.
3. **Real terminal fidelity** — xterm.js-rendered panes with full keyboard
   forwarding. Not polled captures.
4. **Tentacle-first** — the UI's primary unit is the tentacle (status,
   activity, inbox), not the tmux pane.
5. **Direct terminal access preserved** — `tmux attach` and CCRC continue to
   work. This is an additive surface.

## Non-goals

- **Not a general terminal.** This is octopus-specific. ttyd/Wetty etc.
  already solve "terminal in the browser."
- **Not a CCRC replacement upstream.** CCRC ships with Claude Code; octopus
  adds its own surface for teams of tentacles.
- **Not mobile-first for MVP.** Phone access is valuable (the Lens PWA sets
  the pattern), but v1 optimizes for desktop / iPad-horizontal.
- **Not a multi-user collaboration product.** Single operator, single box,
  single tmux server. Team here means tentacles, not humans.

## Prior art

Six candidates, clustered by category.

### Pure web-terminal bridges

| Tool | Stack | What it does | Relevance |
|---|---|---|---|
| **[ttyd](https://github.com/tsl0922/ttyd)** | C + libuv + xterm.js | Wraps any shell command into a WebSocket server with a bundled xterm.js frontend. Single binary, minimal config. | Reference implementation for the bridge. Fast, proven, battle-tested. Worth studying their pty handling even if we don't embed it. |
| **[GoTTY](https://github.com/yudai/gotty)** | Go + xterm.js | Same idea as ttyd, earlier. Less active upstream (last release 2017). | Historical interest only. |
| **[Wetty](https://github.com/butlerx/wetty)** | Node + xterm.js | Web terminal with built-in SSH integration. Most configurable of the three. | Node-native fits our stack. Has auth middleware patterns we could borrow. |

### Richer terminal products

| Tool | Stack | What it does | Relevance |
|---|---|---|---|
| **[Shellngn](https://www.shellngn.com/)** | Commercial SaaS, xterm.js | Web-based multi-protocol (SSH/SFTP/Telnet/RDP) session client with server-side session persistence and a polished dashboard. | Closest commercial analog. Their session-list-sidebar + active-pane layout is essentially what we want. **Not open source**, but the UX shape is public. |
| **[Warp](https://www.warp.dev/)** | Rust + custom GPU renderer | Desktop terminal with "command blocks" (each invocation is a structured unit), AI integration, shareable sessions. Not web-based. | The UX lesson, not the stack. Blocks > scrollback; typography and spacing matter; a terminal can feel like a designed product. |
| **[Tabby](https://tabby.sh/)** (ex-Terminus) | Electron + xterm.js | Desktop terminal with tabs/panes, SSH and tmux integration, plugin architecture. | Plugin model is overkill for us, but the tmux-session-as-first-class pattern is relevant. |

### What we inherit

- **xterm.js** is the right renderer. All six products use it (except Warp's
  custom renderer). It's the de-facto browser terminal.
- **WebSocket for I/O, plus a thin pty bridge on the server** is the canonical
  pattern. Don't invent here.
- **Sidebar of sessions + active pane in the main area** (Shellngn, Tabby)
  is the natural layout. Our tentacle list maps directly to this.
- **Resist xterm.js addon sprawl.** `xterm-addon-fit` and
  `xterm-addon-web-links` are worth it; others rarely are.

### What we avoid

- **Don't embed ttyd as a subprocess.** Its frontend isn't themeable enough
  and the C-program dependency is out of character for a Bun-native project.
  Port the pattern, don't adopt the binary.
- **Don't build plugin architecture.** Tabby's plugin system is a
  distraction for an MVP. Ship one good UI.
- **Don't try to be Warp.** Command blocks, AI autocomplete in the shell,
  session sharing — all cool, all scope creep.

## MVP shape

The smallest version that beats CCRC. Ship this first.

### In scope

1. **Tentacle list sidebar** — real-time status (idle / working / dead),
   activity indicator (how long since the pane last changed),
   last-mentioned-by-team-lead highlight (already computed in `state.ts`),
   color-coded by the existing `colors.ts` palette.
2. **Active pane view** — full xterm.js render of the selected tentacle's
   tmux pane. Bidirectional: type into the terminal, see real output. Full
   keyboard forwarding including `Ctrl-C`, `Esc`, arrows, `Tab`.
3. **Team-lead pane as the default view** when nothing else is selected —
   the team-lead is the orchestration center, it should be the landing.
4. **SendMessage overlay** on each tentacle card — input box that routes
   to `POST /api/panes/:name/send` with the idle-wake nudge (depends on
   #16 landing).
5. **Spawn + shutdown affordances** — restyled versions of today's modal
   and dead-tentacle reclaim button.
6. **Parachute design language** — Lens-level polish on typography, color,
   spacing, card chrome, transitions. This is the differentiator.

### Deferred to v2

- Task / activity feed across tentacles. Needs a cross-session event bus
  that octopus doesn't have today. Punt until there's a real source of
  events (likely via Claude Code session logs or a future agents
  runtime).
- Inbox visualization. Requires Claude Code to surface the inbox; external
  dependency.
- Search across sessions — useful but heavy.
- Multi-octopus pod polish. Today's pod tabs work; they can stay ugly for
  v1.
- Mobile layout. PWA comes in phase 2 once the desktop shape is right.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser — Preact + xterm.js                            │
│                                                         │
│  ┌───────────────┐  ┌──────────────────────────────┐   │
│  │ Tentacle      │  │  xterm.js viewport           │   │
│  │ sidebar       │  │  (bound to selected pane)    │   │
│  │ - status      │  │                              │   │
│  │ - activity    │  │  ┌─────────────────────────┐ │   │
│  │ - SendMessage │  │  │ Chat overlay (optional) │ │   │
│  │   pill        │  │  │ SendMessage input +     │ │   │
│  │ - shutdown ✕  │  │  │ idle-wake nudge         │ │   │
│  │               │  │  └─────────────────────────┘ │   │
│  │ [+ spawn]     │  │                              │   │
│  └───────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                │                    │
                │ SSE (status)       │ WebSocket (tty I/O)
                ▼                    ▼
┌─────────────────────────────────────────────────────────┐
│  Hono server — src/ui/server.tsx (extended)             │
│                                                         │
│  Existing:                                              │
│    GET  /api/state                roster snapshot       │
│    GET  /api/stream               SSE state ticks       │
│    POST /api/spawn                /spawn dispatch       │
│    POST /api/shutdown/:name       /exit dispatch        │
│    POST /api/panes/:name/send     tmux send-keys        │
│                                                         │
│  New:                                                   │
│    WS   /api/tty/:name            bidirectional pty     │
│                                    bridge — spawn       │
│                                    `tmux attach -t`     │
│                                    with node-pty or     │
│                                    Bun.spawn(pty),      │
│                                    pipe to WebSocket    │
└─────────────────────────────────────────────────────────┘
                │
                │ tmux IPC (unchanged)
                ▼
┌─────────────────────────────────────────────────────────┐
│  tmux server — unchanged                                │
│    team-lead pane, tentacle panes, octopus-ui window    │
└─────────────────────────────────────────────────────────┘
```

### Backend extensions

- **New WebSocket upgrade handler** at `GET /api/tty/:name`. Looks up the
  tentacle's `livePaneId` from the snapshot, spawns `tmux attach-session -t
  <session> -r` (read-only at first; see Open Questions) and pipes stdin
  and stdout bidirectionally to the WebSocket. `node-pty` is the canonical
  Node dependency for this; Bun has `Bun.spawn` with pty support that we'd
  prefer if it's stable enough by launch+30 days.
- **WebSocket lifecycle** ties to tentacle lifecycle. When the tentacle
  dies, the tmux pane closes, the pty closes, the WebSocket closes with a
  clean close code that the frontend renders as "tentacle exited."
- **Resize** — xterm.js emits `resize(cols, rows)`; server forwards via
  `tmux resize-window` or equivalent.
- **Auth** — see Auth section below.

### Frontend

- **Preact over React.** The existing UI is SSR'd Hono JSX; Preact + HTM
  keeps bundle size low and matches the "Bun-native, no bundler" feel.
  (React is fine too; decision is about bundler overhead.)
- **xterm.js per attached pane.** One terminal instance, bound to one
  tentacle at a time. Switching tentacles tears down the WebSocket and
  opens a new one; xterm.js instances are cheap.
- **Styling in one place.** Reuse `src/ui/colors.ts` as the color palette
  source. Add a typography scale and spacing scale consistent with Lens.
- **SSR-first fallback preserved.** `curl /` keeps working. The React
  shell hydrates over the SSR output.

## Auth

Three interlocking decisions.

### Network layer (primary, unchanged)

Today's model works: `0.0.0.0` on a Tailscale interface, loopback
otherwise. This is the right default for the single-operator case and we
keep it.

### App-layer token (optional, new)

For the Tailscale-from-phone-at-coffee-shop scenario, a simple
`--auth-token <value>` flag would gate the WebSocket + API. Minimal
ceremony: generate a token on `octopus ui`, print it to the terminal,
append it to the URL as `?t=<token>`.

### Hub-issued OAuth (later, optional)

Aaron's second message suggested "probably the same OAuth/token story as
other Parachute services." Hub-as-portal OAuth
(`design/2026-04-20-hub-as-portal-oauth-and-service-catalog.md` in
parachute.computer) is the right destination for a cloud-deployed octopus,
but it's heavy for local use. Punt to a v3.

### Security-critical detail

WebSocket endpoints that spawn pty to tmux panes have full shell-execution
power. They MUST NOT be exposed on the open internet without app-layer
auth. Today's README calls this out for the dashboard; the TUI makes the
stakes higher and the doc should update accordingly.

## Coexistence with CCRC

Both surfaces stay functional. Different tools for different moments.

| Scenario | Right tool |
|---|---|
| Quick one-off "what's this tentacle doing" from a terminal | `tmux attach` |
| Scripted interaction with a single Claude Code session | CCRC |
| Multi-tentacle orchestration, at-a-glance status, message routing | octopus TUI |
| Full terminal fidelity for a single pane | octopus TUI or `tmux attach` |

The existing `octopus ui` CLI stays. It gains a new frontend; the CLI
surface (start/stop/status/restart) is unchanged. `--legacy` flag could
preserve today's SSR-only dashboard for users who prefer it, or a
migration path can just rebuild both shells from the same server.

## Scope estimate

| Phase | What ships | Estimate |
|---|---|---|
| 0 | pty bridge + xterm.js integration (no styling) | 1-2 days |
| 1 | Tentacle sidebar + active pane view with Parachute styling | 3-4 days |
| 2 | SendMessage overlay + spawn/shutdown affordances | 2 days |
| 3 | Polish pass (transitions, empty states, error states, keyboard shortcuts) | 2-3 days |
| **MVP total** | | **~8-11 working days** |

Post-MVP items (task feed, inbox viz, mobile PWA, search) each add another
week of scope.

## Risks and unknowns

1. **Claude Code TUI fidelity in xterm.js.** Claude Code paints a
   non-trivial TUI (status line, colored glyphs, `@mentions` strip). Most
   of it is standard ANSI, but some sequences may need tuning. Mitigation:
   build the pty bridge first, attach it to a running Claude Code pane,
   see what breaks before investing in frontend chrome.
2. **Multi-client semantics.** If two browsers open the same tentacle,
   they both attach to the tmux pane. tmux handles this (concurrent
   attach is legal; each client gets an independent view modulo the
   shared cursor). Decide explicitly whether we allow it or lock to one
   client at a time.
3. **Resize coordination.** Two clients with different viewport sizes
   attached to the same pane fight over `resize-window`. The simplest
   answer is "last-resize wins, accept the glitch." The ambitious answer
   is per-client virtual sizes (tmux has `-Z` zoom and pane-specific
   sizing).
4. **Pane lifecycle races.** Tentacle dies mid-WebSocket → we need a
   clean close, not an error spiral. Needs careful handling but is a
   solved problem in ttyd/Wetty; borrow their patterns.
5. **Bun's pty story.** Bun has `Bun.spawn` with pty support in recent
   versions. If it's stable, use it (one dep). If not, `node-pty` is the
   fallback (compiled C, but widely used).

## Open questions for Aaron

1. **Preact vs React?** Bundler-free defaults push toward Preact + HTM.
   React is fine if the team would rather be on the larger ecosystem.
2. **Read-only pane mode by default?** Accidental keystrokes into a busy
   tentacle are disruptive. "Click to unlock input" is a reasonable
   safety; or we trust the user.
3. **Should the team-lead pane also be attachable here?** Arguably yes —
   typing to the team-lead from the browser is the happy path for
   delegating work from a phone. But the team-lead pane is where
   slash-commands originate; typing the wrong thing there has high
   blast radius.
4. **Where does this live in the repo?** Current `src/ui/` is the SSR
   dashboard. Options: extend it (new routes, new components), or
   `src/tui/` as a new sibling with its own entry. Leaning toward
   extending `src/ui/` — one server, one frontend, two render modes.
5. **What's the launch vehicle?** Ship behind a flag in `octopus ui
   --beta-tui` first, or go straight to default once it's done? Probably
   flagged until we've burned a week on it in real use.

## Dependencies and sequencing

1. **Resolve #16 first** — SendMessage idle wake-up. Without it, the
   chat overlay is a black hole.
2. **Tackle #19 second** — de-emphasize the opinionated-init framing.
   Lands cleaner with a repo positioned as "UI over tmux."
3. **Then this.** The RFC becomes an implementation plan once #16 and
   #19 are settled.

## Appendix: why not just restyle today's SSR dashboard?

Tempting, but it's a dead end. The current dashboard polls `capture-pane`
every 2s, strips ANSI, and renders a static tail. That's not a terminal —
it's a log viewer. No amount of CSS lipstick gets us to "type `ls` and
see the output render in real time." The pty bridge is the minimum
viable upgrade; once we're doing that, we may as well put real chrome
around it.

## Appendix: what Parachute-polish means in practice

Looking at Lens as the reference:
- Monospace for code and terminal, but sans-serif (Inter or similar) for
  UI chrome. Two-typeface rhythm, not one.
- 8px grid. Spacing matters.
- Color palette from `colors.ts` gets expanded with semantic tokens
  (surface, surface-raised, text-primary, text-muted, accent, accent-
  hover, danger).
- Transitions under 200ms. No flashy animation.
- Dark mode first (Aaron works in dark). Light mode later or never.
- Empty states with character, not "No tentacles found." Borrow Lens's
  tone.
