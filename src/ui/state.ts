import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { capturePane, extractTentacleName, isClaudeCodePane, isPrimarySessionPane, listPanes } from "./tmux.ts";

export interface ConfigMember {
  agentId: string;
  name: string;
  agentType: string;
  model?: string;
  joinedAt: number;
  tmuxPaneId: string;
  cwd: string;
  color?: string;
  prompt?: string;
}

export interface TeamConfig {
  name: string;
  description?: string;
  createdAt: number;
  members: ConfigMember[];
}

export interface Tentacle {
  name: string;
  agentType: string;
  cwd: string;
  cwdShort: string;
  color: string;
  joinedAt: number;
  configPaneId: string;
  livePaneId: string | null;
  status: "idle" | "working" | "dead";
  stale: boolean;
  lastTail: string[];
  lastActivityMs: number | null;
  fullTail?: string;
  // Only populated on the team-lead row: tentacle names recently mentioned
  // (`@name`) in the team-lead's pane, used to highlight which tentacles the
  // head just poked.
  recentlyMentioned?: string[];
}

export interface Snapshot {
  generatedAt: number;
  team: string;
  tentacles: Tentacle[];
  orphans: OrphanPane[];
  totalMembers: number;
  livePanes: number;
}

export interface OrphanPane {
  paneId: string;
  session: string;
  tentacleName: string | null;
  tail: string[];
}

// Mutable so the CLI/server can inject the resolved team config path at
// startup. Tests and standalone usage fall back to the legacy ~/.claude
// location for backwards compatibility.
let currentConfigPath = join(homedir(), ".claude", "teams", "octopus", "config.json");

export function setConfigPath(path: string): void {
  currentConfigPath = path;
}

export function getConfigPath(): string {
  return currentConfigPath;
}

const DEFAULT_COLOR = "slate";

const CAPTURE_LINES = 40;

const activityCache = new Map<string, { hash: string; at: number }>();

// Last-known primary-session pane id, with timestamp. Survives transient
// detection misses (e.g. during slash-command dispatch when the teammates
// strip momentarily re-renders without recognizable signals). New positive
// detections always win immediately; we only fall back to the cache when no
// pane currently matches and the last hit is recent.
const PRIMARY_CACHE_TTL_MS = 30_000;
let primaryCache: { paneId: string; at: number } | null = null;

export async function loadConfig(path: string = currentConfigPath): Promise<TeamConfig> {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw) as TeamConfig;
  } catch (err: any) {
    if (err?.code === "ENOENT") {
      console.log(`team config not found at ${path}; dashboard will populate when team is created`);
      return { name: "octopus", createdAt: Date.now(), members: [] };
    }
    throw err;
  }
}

export function shortCwd(cwd: string): string {
  if (!cwd) return "";
  const home = homedir();
  const rel = cwd.startsWith(home) ? cwd.slice(home.length + 1) : cwd;
  const parts = rel.split("/").filter(Boolean);
  return parts.slice(-2).join("/");
}

function hashLines(lines: string[]): string {
  // Cheap hash: concat last few non-empty lines
  return lines.slice(-6).join("|").slice(0, 400);
}

export function deriveStatus(tail: string[]): "idle" | "working" {
  // Scan last ~15 non-empty lines
  const recent = tail.filter((l) => l.trim()).slice(-15);
  const joined = recent.join("\n");
  if (/Running…|Cogitated|Sautéed|Pondering|Thinking|Simmering|Marinating|Musing|Ruminating|Percolating|Brewing|Distilling|Stewing/.test(joined)) {
    return "working";
  }
  // Look for a bare prompt `❯` near the bottom → idle
  for (let i = recent.length - 1; i >= Math.max(0, recent.length - 5); i--) {
    if (/^\s*❯\s*$/.test(recent[i])) return "idle";
    if (/^\s*❯\s+/.test(recent[i])) return "idle"; // prompt with prior text
  }
  // Remote Control active line alone = idle-ish
  if (/Remote Control active/.test(joined) && !/Running…/.test(joined)) return "idle";
  return "idle";
}

function stripStatusLines(lines: string[]): string[] {
  // Drop the separator/status chrome lines so the tail is useful
  return lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (/^─+$/.test(t)) return false;
    if (/^─+\s+@[a-zA-Z0-9_-]+\s+─+$/.test(t)) return false;
    if (/bypass permissions on/.test(t)) return false;
    if (/Remote Control active/.test(t)) return false;
    return true;
  });
}

export interface InstanceContext {
  configPath?: string;
  session?: string;
}

export async function buildSnapshot(ctx?: InstanceContext): Promise<Snapshot> {
  const config = await loadConfig(ctx?.configPath);
  const livePanes = await listPanes(ctx?.session);

  // First pass — capture every pane, extract tentacle name from content
  const captures = await Promise.all(
    livePanes.map(async (p) => {
      const content = await capturePane(p.paneId, CAPTURE_LINES);
      return { pane: p, content, name: extractTentacleName(content) };
    }),
  );

  const byName = new Map<string, (typeof captures)[number]>();
  for (const c of captures) {
    if (c.name) byName.set(c.name, c);
  }

  // The team-lead / primary session doesn't wear a `── @name ──` banner.
  // Detect it by the teammates strip / count instead. Cache the answer for 30s
  // so a transient miss during slash-command dispatch doesn't make the
  // team-lead card vanish from the grid.
  //
  // Fallback: if no pane has the @main strip (session not in team mode),
  // look for any untagged Claude Code pane — that's likely the team-lead.
  const now = Date.now();
  const tentacleNames = new Set(captures.filter((c) => c.name).map((c) => c.name));
  let primarySessionCapture = captures.find((c) => isPrimarySessionPane(c.content));
  if (!primarySessionCapture) {
    // Fallback: untagged Claude Code pane (not a tentacle)
    primarySessionCapture = captures.find(
      (c) => !c.name && !tentacleNames.has(c.name) && isClaudeCodePane(c.content),
    );
  }
  if (primarySessionCapture) {
    primaryCache = { paneId: primarySessionCapture.pane.paneId, at: now };
  } else if (primaryCache && now - primaryCache.at < PRIMARY_CACHE_TTL_MS) {
    primarySessionCapture = captures.find((c) => c.pane.paneId === primaryCache!.paneId);
  }
  const memberNames = new Set(config.members.map((m) => m.name));
  const mentioned = primarySessionCapture
    ? extractMentions(primarySessionCapture.content, memberNames)
    : [];
  const tentacles: Tentacle[] = config.members.map((m) => {
    const matchByName = byName.get(m.name);
    const matchByConfigId = captures.find((c) => c.pane.paneId === m.tmuxPaneId);
    const matchByPrimary = m.agentType === "team-lead" ? primarySessionCapture : undefined;
    // Prefer name match — authoritative when tmuxPaneId drifted.
    // Fall back to primary-session detection for the team-lead row.
    const match = matchByName ?? matchByPrimary ?? matchByConfigId;

    let tail: string[] = [];
    let status: Tentacle["status"] = "dead";
    let lastActivityMs: number | null = null;
    let fullTail: string | undefined;

    if (match) {
      const lines = match.content.split("\n");
      const clean = stripStatusLines(lines);
      tail = clean.slice(-10);
      fullTail = match.content;
      status = deriveStatus(lines);

      const h = hashLines(clean);
      const cached = activityCache.get(match.pane.paneId);
      if (!cached) {
        // First sighting — we don't know when this pane last changed. Store
        // the hash so we can detect FUTURE changes, but report lastActivityMs
        // as null so we don't claim "just now" for content that may have been
        // stale for hours before the server started.
        activityCache.set(match.pane.paneId, { hash: h, at: now });
        lastActivityMs = null;
      } else if (cached.hash !== h) {
        // Content changed — real activity, stamp it.
        activityCache.set(match.pane.paneId, { hash: h, at: now });
        lastActivityMs = 0;
      } else {
        lastActivityMs = now - cached.at;
      }
    }

    return {
      name: m.name,
      agentType: m.agentType,
      cwd: m.cwd,
      cwdShort: shortCwd(m.cwd),
      color: m.color || DEFAULT_COLOR,
      joinedAt: m.joinedAt,
      configPaneId: m.tmuxPaneId,
      livePaneId: match?.pane.paneId ?? null,
      status: match ? status : "dead",
      // team-lead's configPaneId is always empty (it IS the session running this
      // UI, never a spawned teammate). Don't flag it stale when we match via the
      // primary-session detector; only flag stale if configPaneId is non-empty
      // and drifted.
      stale: match
        ? m.tmuxPaneId !== "" && match.pane.paneId !== m.tmuxPaneId
        : true,
      lastTail: tail,
      lastActivityMs,
      fullTail,
      recentlyMentioned: m.agentType === "team-lead" ? mentioned : undefined,
    };
  });

  // Synthesize a team-lead entry if the primary session was detected but
  // isn't in config.members. This ensures the hero card always shows up
  // when a team-lead pane is live, even before any tentacles are spawned.
  const hasConfiguredLead = config.members.some((m) => m.agentType === "team-lead");
  if (!hasConfiguredLead && primarySessionCapture) {
    const lines = primarySessionCapture.content.split("\n");
    const clean = stripStatusLines(lines);
    const h = hashLines(clean);
    const cached = activityCache.get(primarySessionCapture.pane.paneId);
    let lastActivityMs: number | null = null;
    if (!cached) {
      activityCache.set(primarySessionCapture.pane.paneId, { hash: h, at: now });
    } else if (cached.hash !== h) {
      activityCache.set(primarySessionCapture.pane.paneId, { hash: h, at: now });
      lastActivityMs = 0;
    } else {
      lastActivityMs = now - cached.at;
    }

    tentacles.unshift({
      name: "team-lead",
      agentType: "team-lead",
      cwd: "",
      cwdShort: "",
      color: "amber",
      joinedAt: config.createdAt,
      configPaneId: "",
      livePaneId: primarySessionCapture.pane.paneId,
      status: deriveStatus(lines),
      stale: false,
      lastTail: clean.slice(-10),
      lastActivityMs,
      fullTail: primarySessionCapture.content,
      recentlyMentioned: mentioned,
    });
  }

  // Orphans: live panes whose tentacle name (if any) is not in the config
  const configNames = new Set(config.members.map((m) => m.name));
  // Exclude the synthesized team-lead pane from orphans
  const teamLeadPaneId = primarySessionCapture?.pane.paneId;
  const orphans: OrphanPane[] = captures
    .filter((c) => c.pane.paneId !== teamLeadPaneId && (!c.name || !configNames.has(c.name)))
    .map((c) => ({
      paneId: c.pane.paneId,
      session: c.pane.session,
      tentacleName: c.name,
      tail: stripStatusLines(c.content.split("\n")).slice(-4),
    }));

  return {
    generatedAt: now,
    team: config.name,
    tentacles,
    orphans,
    totalMembers: config.members.length,
    livePanes: livePanes.length,
  };
}

// Pull `@name` mentions out of the last ~20 non-empty lines of the team-lead's
// pane. Filter to known member names so chatter like `@anthropic` doesn't
// register. Excludes `@main` itself (always present in the teammates strip).
const MENTION_LINES = 20;
const MENTION_REGEX = /@([a-zA-Z0-9_-]+)/g;

export function extractMentions(paneContent: string, knownNames: Set<string>): string[] {
  const lines = paneContent.split("\n").filter((l) => l.trim());
  const recent = lines.slice(-MENTION_LINES).join("\n");
  const seen = new Set<string>();
  for (const m of recent.matchAll(MENTION_REGEX)) {
    const name = m[1];
    if (name === "main") continue;
    if (knownNames.has(name)) seen.add(name);
  }
  return [...seen];
}

export async function snapshotForTentacle(name: string, lines = 200, ctx?: InstanceContext): Promise<{
  tentacle: Tentacle | null;
  output: string;
}> {
  const snap = await buildSnapshot(ctx);
  const t = snap.tentacles.find((x) => x.name === name);
  if (!t || !t.livePaneId) return { tentacle: t ?? null, output: "" };
  const output = await capturePane(t.livePaneId, lines);
  return { tentacle: t, output };
}
