/** @jsxImportSource hono/jsx */
import type { Snapshot, Tentacle } from "./state.ts";
import type { PodStatus } from "../pod.ts";
import { colorFor } from "./colors.ts";
import { formatAge, formatJoinedAt } from "./format.ts";

interface LayoutProps {
  title: string;
  children: any;
}

function Layout({ title, children }: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0f1715" />
        <title>{title}</title>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500..700;1,500..700&family=JetBrains+Mono:wght@400;500&display=swap"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body data-page={title}>{children}</body>
    </html>
  );
}

// Abstract octopus glyph — soft-geometric, stroked in currentColor.
function OctopusGlyph() {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M20 26 C20 16, 26 10, 32 10 S44 16, 44 26 V30 C44 32, 42 34, 40 34 H24 C22 34, 20 32, 20 30 Z"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linejoin="round"
      />
      <circle cx="27.5" cy="23" r="1.4" fill="currentColor" />
      <circle cx="36.5" cy="23" r="1.4" fill="currentColor" />
      <path d="M23 34 C21 42, 15 46, 18 56" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      <path d="M30 34 C31 42, 26 50, 30 58" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      <path d="M34 34 C33 42, 38 50, 34 58" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      <path d="M41 34 C43 42, 49 46, 46 56" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
    </svg>
  );
}

function ParachuteGlyph() {
  return (
    <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 50 C12 28, 28 14, 48 14 S84 28, 84 50" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
      <path d="M12 50 Q30 44 48 50 T84 50" stroke="currentColor" stroke-width="1.3" opacity="0.55" />
      <path d="M30 18 V50" stroke="currentColor" stroke-width="1.1" opacity="0.5" />
      <path d="M48 14 V50" stroke="currentColor" stroke-width="1.1" opacity="0.5" />
      <path d="M66 18 V50" stroke="currentColor" stroke-width="1.1" opacity="0.5" />
      <path
        d="M14 50 L44 78 M30 50 L46 78 M48 50 L48 80 M66 50 L50 78 M82 50 L52 78"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        opacity="0.75"
      />
      <circle cx="48" cy="84" r="4" stroke="currentColor" stroke-width="1.8" />
    </svg>
  );
}

// Three-arm SVG flowing from the bottom of the hero card down into the grid.
// Decorative — sits behind the cards and never catches clicks. The amber-glow
// `is-flowing` state is added by the client when team-lead is working.
function ArmsLayer() {
  return (
    <svg
      class="arms-layer"
      viewBox="0 0 1200 120"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arm-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(122,176,157,0.32)" />
          <stop offset="100%" stop-color="rgba(122,176,157,0)" />
        </linearGradient>
      </defs>
      <path
        class="arm arm-l"
        d="M380 0 C 380 40, 240 60, 200 120"
        stroke="url(#arm-gradient)"
        fill="none"
        stroke-width="1.4"
        stroke-linecap="round"
      />
      <path
        class="arm arm-c"
        d="M600 0 C 600 50, 600 70, 600 120"
        stroke="url(#arm-gradient)"
        fill="none"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <path
        class="arm arm-r"
        d="M820 0 C 820 40, 960 60, 1000 120"
        stroke="url(#arm-gradient)"
        fill="none"
        stroke-width="1.4"
        stroke-linecap="round"
      />
    </svg>
  );
}

function Header({ snap }: { snap: Snapshot }) {
  const alive = snap.tentacles.filter((t) => t.status !== "dead").length;
  return (
    <header class="app-header">
      <div class="app-header-inner">
        <div class="brand">
          <span class="brand-glyph" aria-hidden="true">
            <OctopusGlyph />
          </span>
          <span class="brand-name">Octopus</span>
          <span class="brand-team">/ {snap.team}</span>
        </div>
        <div class="meta">
          <span class="stat-pill" data-stat="alive">
            <span class="stat-value">{alive}</span>
            <span class="stat-label">alive</span>
          </span>
          <span class="stat-pill" data-stat="roster">
            <span class="stat-value">{snap.totalMembers}</span>
            <span class="stat-label">roster</span>
          </span>
          <span class="stat-pill" data-stat="panes">
            <span class="stat-value">{snap.livePanes}</span>
            <span class="stat-label">panes</span>
          </span>
          <span class="stat-pill refresh-stat" data-stat="stream">
            <span class="stat-value" id="refresh-indicator">
              live
            </span>
            <span class="stat-label">stream</span>
          </span>
          <button class="btn btn-ghost" id="refresh-btn" title="Refresh (r)">
            refresh
          </button>
          <button class="btn btn-primary" id="spawn-btn" title="Spawn a new tentacle (n)">
            <span class="spawn-glyph" aria-hidden="true">🐙</span>
            <span>spawn</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function SpawnModal() {
  return (
    <div class="modal-backdrop" id="spawn-modal" hidden>
      <div class="modal" role="dialog" aria-labelledby="spawn-title" aria-modal="true">
        <header class="modal-head">
          <h2 id="spawn-title">Spawn a tentacle</h2>
          <button type="button" class="modal-close" data-modal-close="spawn-modal" aria-label="close">
            ×
          </button>
        </header>
        <form id="spawn-form" class="modal-body">
          <label>
            <span class="field-label">Name</span>
            <input
              type="text"
              name="name"
              class="mono"
              required
              pattern="[a-z][a-z0-9\-]{1,30}"
              placeholder="parachute-foo"
              autocomplete="off"
              spellcheck={false}
            />
            <span class="field-hint">lowercase, digits, dashes; starts with a letter</span>
          </label>
          <label>
            <span class="field-label">Working directory</span>
            <input
              type="text"
              name="cwd"
              class="mono"
              list="spawn-target-list"
              required
              placeholder="/Users/you/UnforcedAGI/Code/ParachuteComputer/…"
              autocomplete="off"
              spellcheck={false}
            />
            <datalist id="spawn-target-list" />
          </label>
          <label>
            <span class="field-label">Clone from (optional)</span>
            <input
              type="text"
              name="cloneUrl"
              class="mono"
              placeholder="https://github.com/org/repo.git"
              autocomplete="off"
              spellcheck={false}
            />
            <span class="field-hint">only used if the working directory doesn't exist yet</span>
          </label>
          <label>
            <span class="field-label">Initial brief</span>
            <textarea
              name="prompt"
              class="mono"
              rows={6}
              placeholder="What should this tentacle do first?"
              spellcheck={false}
            />
            <span class="field-hint">team-lead will pick up this request and spawn the tentacle</span>
          </label>
          <p class="field-error" id="spawn-error" hidden></p>
          <footer class="modal-foot">
            <button type="button" class="btn btn-ghost" data-modal-close="spawn-modal">
              cancel
            </button>
            <button type="submit" class="btn btn-primary">
              spawn
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

function ShutdownModal() {
  return (
    <div class="modal-backdrop" id="shutdown-modal" hidden>
      <div class="modal modal-compact" role="dialog" aria-labelledby="shutdown-title" aria-modal="true">
        <header class="modal-head">
          <h2 id="shutdown-title">Shut down tentacle?</h2>
          <button type="button" class="modal-close" data-modal-close="shutdown-modal" aria-label="close">
            ×
          </button>
        </header>
        <div class="modal-body">
          <p class="soft">
            Send <code class="mono">/exit</code> to <strong id="shutdown-name" class="mono" /> and
            queue a shutdown request. Its pane will terminate.
          </p>
        </div>
        <footer class="modal-foot">
          <button type="button" class="btn btn-ghost" data-modal-close="shutdown-modal">
            cancel
          </button>
          <button type="button" class="btn btn-danger" id="shutdown-confirm">
            shut down
          </button>
        </footer>
      </div>
    </div>
  );
}

function SearchRow() {
  return (
    <div class="search-row">
      <input
        type="search"
        id="search"
        placeholder="Filter tentacles by name or cwd…  (press /)"
        autocomplete="off"
        spellcheck={false}
      />
    </div>
  );
}

function StatusDot({ status }: { status: Tentacle["status"] }) {
  return <span class={`status-dot status-${status}`} aria-label={status} />;
}

function TailRegion({ t }: { t: Tentacle }) {
  if (t.lastTail.length === 0) {
    return (
      <pre class="tail tail-quiet" aria-label={`recent output from ${t.name}`}>
        <span class="quiet-line">
          {t.status === "dead" ? "pane not found in live tmux" : "quiet for a moment"}
        </span>
      </pre>
    );
  }
  return (
    <pre class="tail" aria-label={`recent output from ${t.name}`}>
      {t.lastTail.join("\n")}
    </pre>
  );
}

function Card({ t, compact }: { t: Tentacle; compact?: boolean }) {
  const accent = colorFor(t.color);
  return (
    <article
      class={`card card-${t.status}${t.stale ? " card-stale" : ""}${compact ? " card-compact" : ""}`}
      data-name={t.name}
      data-cwd={t.cwdShort}
      data-status={t.status}
      style={`--tentacle: ${accent};`}
    >
      <header class="card-head">
        <div class="card-title">
          <StatusDot status={t.status} />
          <h2 class="tentacle-name" style={`color: ${accent};`}>
            {t.name}
          </h2>
        </div>
        <div class="card-meta">
          <span class={`pill pill-${t.agentType}`}>{t.agentType}</span>
          {t.stale && (
            <span class="pill pill-warn" title="config tmuxPaneId doesn't match any live pane">
              stale
            </span>
          )}
          <button
            type="button"
            class="card-close"
            data-shutdown={t.name}
            title={`Shut down ${t.name}`}
            aria-label={`Shut down ${t.name}`}
          >
            ×
          </button>
        </div>
      </header>

      <dl class="card-facts">
        <div>
          <dt>cwd</dt>
          <dd class="mono" title={t.cwd}>
            {t.cwdShort || "—"}
          </dd>
        </div>
        <div>
          <dt>pane</dt>
          <dd class="mono">{t.livePaneId ?? <span class="dim">dead</span>}</dd>
        </div>
        <div>
          <dt>activity</dt>
          <dd class="age" data-age={t.lastActivityMs ?? ""}>
            {formatAge(t.lastActivityMs)}
          </dd>
        </div>
        <div>
          <dt>joined</dt>
          <dd>{formatJoinedAt(t.joinedAt)}</dd>
        </div>
      </dl>

      <TailRegion t={t} />

      <footer class="card-foot">
        <a class="btn btn-primary" href={`/pane/${encodeURIComponent(t.name)}`}>
          open
        </a>
      </footer>
    </article>
  );
}

// Hero card — horizontal banner: glyph | titles | tail | open button.
function HeroCard({ t }: { t: Tentacle }) {
  const accent = colorFor(t.color) || "#7AB09D";
  const tail = t.lastTail.length === 0 ? null : t.lastTail.slice(-12).join("\n");
  return (
    <article
      class={`hero hero-${t.status}`}
      id="hero-card"
      data-name={t.name}
      data-status={t.status}
      style={`--tentacle: ${accent};`}
    >
      <div class="hero-glyph" aria-hidden="true">
        <OctopusGlyph />
      </div>
      <div class="hero-titles">
        <div class="hero-row">
          <StatusDot status={t.status} />
          <h2 class="hero-name">{t.name}</h2>
          <span class="pill pill-team-lead">team-lead</span>
        </div>
        <div class="hero-sub">
          <span class="mono dim" title={t.cwd}>
            {t.cwdShort || "—"}
          </span>
          <span class="hero-dot">·</span>
          <span class="mono dim">pane {t.livePaneId ?? "—"}</span>
          <span class="hero-dot">·</span>
          <span class="age" data-age={t.lastActivityMs ?? ""}>
            {formatAge(t.lastActivityMs)}
          </span>
        </div>
      </div>
      <pre class="hero-tail" aria-label={`recent output from ${t.name}`}>
        {tail ?? <span class="quiet-line">quiet for a moment</span>}
      </pre>
      <a class="btn btn-primary hero-open" href={`/pane/${encodeURIComponent(t.name)}`}>
        open
      </a>
    </article>
  );
}

function EmptyState() {
  return (
    <div class="empty">
      <div class="empty-glyph" aria-hidden="true">
        <ParachuteGlyph />
      </div>
      <h2>No tentacles awake</h2>
      <p class="soft">They rest between tasks.</p>
    </div>
  );
}

function PodTabs({ octopi, active }: { octopi?: PodStatus[]; active?: string }) {
  if (!octopi || octopi.length <= 1) return null;
  return (
    <nav class="pod-tabs" aria-label="octopus instances">
      {octopi.map((o) => (
        <a
          class={`pod-tab${o.name === active ? " pod-tab-active" : ""}${o.running ? "" : " pod-tab-stopped"}`}
          href={`/?instance=${encodeURIComponent(o.name)}`}
          title={o.description || o.scope}
        >
          <span class={`pod-dot${o.running ? " pod-dot-running" : ""}`} />
          {o.name}
        </a>
      ))}
      <a class="pod-tab pod-tab-overview" href="/" title="Pod overview">
        all
      </a>
    </nav>
  );
}

export function PodOverviewPage({ octopi }: { octopi: PodStatus[] }) {
  return (
    <Layout title="Octopus Pod">
      <header class="app-header">
        <div class="app-header-inner">
          <div class="brand">
            <span class="brand-glyph" aria-hidden="true">
              <OctopusGlyph />
            </span>
            <span class="brand-name">Octopus</span>
            <span class="brand-team">/ pod</span>
          </div>
          <div class="meta">
            <span class="stat-pill" data-stat="octopi">
              <span class="stat-value">{octopi.length}</span>
              <span class="stat-label">octop{octopi.length === 1 ? "us" : "i"}</span>
            </span>
            <span class="stat-pill" data-stat="running">
              <span class="stat-value">{octopi.filter((o) => o.running).length}</span>
              <span class="stat-label">running</span>
            </span>
          </div>
        </div>
      </header>
      <main class="dashboard">
        <section class="pod-grid">
          {octopi.map((o) => (
            <a class={`pod-card${o.running ? " pod-card-running" : ""}`} href={`/?instance=${encodeURIComponent(o.name)}`}>
              <div class="pod-card-head">
                <span class={`pod-dot${o.running ? " pod-dot-running" : ""}`} />
                <h2>{o.name}</h2>
              </div>
              <dl class="pod-card-facts">
                <div>
                  <dt>scope</dt>
                  <dd class="mono">{o.scope.replace(/^\/Users\/[^/]+/, "~")}</dd>
                </div>
                <div>
                  <dt>status</dt>
                  <dd>{o.running ? "running" : "stopped"}</dd>
                </div>
                {o.description && (
                  <div>
                    <dt>about</dt>
                    <dd>{o.description}</dd>
                  </div>
                )}
              </dl>
            </a>
          ))}
        </section>
      </main>
    </Layout>
  );
}

export function DashboardPage({ snap, podOctopi, activeInstance }: { snap: Snapshot; podOctopi?: PodStatus[]; activeInstance?: string }) {
  const teamLead = snap.tentacles.find((t) => t.agentType === "team-lead");
  const others = snap.tentacles.filter((t) => t.agentType !== "team-lead");
  const mentioned = teamLead?.recentlyMentioned ?? [];
  const compact = others.length >= 6;
  return (
    <Layout title={activeInstance ? `Octopus / ${activeInstance}` : "Octopus"}>
      <Header snap={snap} />
      <PodTabs octopi={podOctopi} active={activeInstance} />
      <SearchRow />
      <main class="dashboard">
        {teamLead && (
          <section
            class="hero-section"
            data-mentioned={mentioned.join(",")}
          >
            <HeroCard t={teamLead} />
            <ArmsLayer />
          </section>
        )}

        {others.length === 0 && !teamLead ? (
          <EmptyState />
        ) : others.length === 0 ? (
          <div class="empty empty-compact">
            <h2>No tentacles awake</h2>
            <p class="soft">The head waits.</p>
          </div>
        ) : (
          <section class="grid" id="grid">
            {others.map((t) => (
              <Card t={t} compact={compact} />
            ))}
          </section>
        )}

        <aside class="split-panel" id="split-panel" hidden>
          <div class="split-panel-head">
            <div class="split-panel-title">
              <span class="status-dot" id="split-status-dot" />
              <span class="split-panel-name" id="split-name" />
              <span class="split-panel-meta" id="split-meta" />
            </div>
            <div class="split-panel-actions">
              <a class="btn btn-ghost" id="split-expand" href="#" title="Open full pane view">expand</a>
              <button type="button" class="split-close" id="split-close" title="Close panel (Esc)" aria-label="close panel">×</button>
            </div>
          </div>
          <pre class="split-scrollback" id="split-scrollback">(loading…)</pre>
          <form class="split-send" id="split-send-form">
            <input type="text" id="split-send-input" placeholder="Send to pane…" autocomplete="off" spellcheck={false} />
            <div class="split-send-row">
              <button type="button" class="btn btn-key" data-split-key="Enter" title="Enter">Enter</button>
              <button type="button" class="btn btn-key" data-split-key="Escape" title="Escape">Esc</button>
              <button type="button" class="btn btn-key" data-split-key="C-c" title="Ctrl+C">Ctrl+C</button>
              <button type="submit" class="btn btn-primary">send</button>
            </div>
          </form>
        </aside>

        {snap.orphans.length > 0 && (
          <details class="orphans">
            <summary>
              <span class="orphans-count">{snap.orphans.length}</span>
              <span class="orphans-label">orphan {snap.orphans.length === 1 ? "pane" : "panes"}</span>
              <span class="orphans-hint">click to expand</span>
            </summary>
            <p class="hint">
              Panes that look like Claude Code sessions but aren't in the octopus config. Usually ad-hoc
              shells or sessions that drifted out of the team.
            </p>
            <ul>
              {snap.orphans.map((o) => (
                <li class="mono">
                  <strong>{o.paneId}</strong> · {o.session} ·{" "}
                  {o.tentacleName ? `@${o.tentacleName}` : <span class="dim">no tentacle tag</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </main>
      <SpawnModal />
      <ShutdownModal />
      <script src="/app.js" type="module" defer />
    </Layout>
  );
}

const MODE_KEYS: { label: string; key: string; title: string }[] = [
  { label: "Esc", key: "Escape", title: "Escape — close modal / exit menu" },
  { label: "Tab", key: "Tab", title: "Tab" },
  { label: "Shift+Tab", key: "BTab", title: "Shift+Tab — Claude Code mode cycle" },
  { label: "Ctrl+C", key: "C-c", title: "Ctrl+C — interrupt" },
  { label: "Ctrl+D", key: "C-d", title: "Ctrl+D — EOF" },
];

const NAV_KEYS: { label: string; key: string; title: string }[] = [
  { label: "Enter", key: "Enter", title: "Enter — approve prompts, submit input" },
  { label: "↑", key: "Up", title: "Up arrow" },
  { label: "↓", key: "Down", title: "Down arrow" },
  { label: "←", key: "Left", title: "Left arrow" },
  { label: "→", key: "Right", title: "Right arrow" },
  { label: "PgUp", key: "PageUp", title: "Page Up" },
  { label: "PgDn", key: "PageDown", title: "Page Down" },
  { label: "Home", key: "Home", title: "Home" },
  { label: "End", key: "End", title: "End" },
];

export function PanePage({ t, output, instance }: { t: Tentacle; output: string; instance?: string }) {
  const accent = colorFor(t.color);
  return (
    <Layout title={`@${t.name} · Octopus`}>
      <header class="app-header">
        <div class="app-header-inner">
          <div class="brand">
            <a href={instance ? `/?instance=${encodeURIComponent(instance)}` : "/"} class="brand-back" aria-label="back">
              ←
            </a>
            <span class="brand-glyph" aria-hidden="true">
              <OctopusGlyph />
            </span>
            <span class="brand-name" style={`color: ${accent};`}>
              @{t.name}
            </span>
            <span class="brand-team mono">{t.cwdShort}</span>
          </div>
          <nav class="pane-nav" id="pane-nav" aria-label="arm navigation">
            <a class="pane-nav-btn pane-nav-prev" id="nav-prev" href="#" aria-label="previous arm" hidden>
              ← <span class="pane-nav-name" id="nav-prev-name"></span>
            </a>
            <a class="pane-nav-btn pane-nav-next" id="nav-next" href="#" aria-label="next arm" hidden>
              <span class="pane-nav-name" id="nav-next-name"></span> →
            </a>
          </nav>
          <div class="meta">
            <StatusDot status={t.status} />
            <span class="dim mono">{t.livePaneId ?? "dead"}</span>
          </div>
        </div>
      </header>
      <main class="pane-view" style={`--tentacle: ${accent};`}>
        <pre class="scrollback" id="scrollback">
          {output || "(no output)"}
        </pre>
        <form class="send-form" id="send-form" data-name={t.name}>
          <input
            type="text"
            id="send-input"
            placeholder="Type a message and press Enter to send to the pane…"
            autocomplete="off"
            spellcheck={false}
          />
          <div class="send-actions">
            <button type="submit" class="btn btn-primary">
              send
            </button>
          </div>
          <details class="controls-toggle" id="controls-toggle">
            <summary class="controls-summary">keys &amp; controls</summary>
            <div class="controls-body">
              <div class="control-row" aria-label="mode keys">
                <span class="control-label">modes</span>
                {MODE_KEYS.map((k) => (
                  <button
                    type="button"
                    class={`btn btn-key${k.key === "BTab" ? " btn-key-accent" : ""}`}
                    data-send-key={k.key}
                    title={k.title}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div class="control-row" aria-label="navigation keys">
                <span class="control-label">nav</span>
                {NAV_KEYS.map((k) => (
                  <button
                    type="button"
                    class="btn btn-key"
                    data-send-key={k.key}
                    title={k.title}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <div class="quick">
                <span class="control-label">slash</span>
                <button type="button" class="btn btn-ghost" data-send="/remote-control">
                  /remote-control
                </button>
                <button type="button" class="btn btn-ghost" data-send="/compact">
                  /compact
                </button>
                <button type="button" class="btn btn-ghost" data-send="/status">
                  /status
                </button>
              </div>
            </div>
          </details>
        </form>
      </main>
      <script src="/pane.js" type="module" defer />
    </Layout>
  );
}
