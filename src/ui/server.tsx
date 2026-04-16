/** @jsxImportSource hono/jsx */
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { readdir, stat } from "node:fs/promises";
import { join, resolve as resolvePath } from "node:path";
import { buildSnapshot, loadConfig, setConfigPath, snapshotForTentacle } from "./state.ts";
import { capturePane, isPrimarySessionPane, isValidKey, listPanes, sendKey, sendKeys } from "./tmux.ts";
import { DashboardPage, PanePage } from "./render.tsx";
import { resolvePublicDir, resolveSpawnTargetRoots, resolveTeamConfigPath } from "../paths.ts";

const PORT = Number(process.env.OCTOPUS_UI_PORT ?? 6061);
// Bind to loopback by default — opt into wider exposure with OCTOPUS_UI_HOST=0.0.0.0.
const HOST = process.env.OCTOPUS_UI_HOST ?? "127.0.0.1";
const POLL_MS = Number(process.env.OCTOPUS_UI_POLL_MS ?? 2000);
const TEAM_NAME = process.env.OCTOPUS_TEAM ?? "octopus";

// Resolve the team config path once at startup using the priority chain
// (CLI flag → project-local → home-dir). State module reads from this.
const TEAM_CONFIG_PATH = resolveTeamConfigPath(TEAM_NAME, process.env.OCTOPUS_TEAM_CONFIG);
setConfigPath(TEAM_CONFIG_PATH);

const PUBLIC_DIR = resolvePublicDir();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, at: Date.now() }));

app.get("/", async (c) => {
  try {
    const snap = await buildSnapshot();
    return c.html("<!doctype html>" + (<DashboardPage snap={snap} />).toString());
  } catch (err) {
    return c.html(renderError(err), 500);
  }
});

app.get("/pane/:name", async (c) => {
  const name = c.req.param("name");
  try {
    const { tentacle, output } = await snapshotForTentacle(name, 300);
    if (!tentacle) return c.text(`Unknown tentacle: ${name}`, 404);
    return c.html("<!doctype html>" + (<PanePage t={tentacle} output={output} />).toString());
  } catch (err) {
    return c.html(renderError(err), 500);
  }
});

app.get("/api/state", async (c) => {
  const snap = await buildSnapshot();
  return c.json(snap);
});

// Identifies this process as an octopus UI. Used by the CLI to decide whether
// a held port belongs to us (no-op on `octopus ui`) or a foreign process
// (refuse to act in `octopus ui stop`).
app.get("/api/health", (c) => {
  return c.json({ name: "octopus-ui", pid: process.pid });
});

app.get("/api/pane/:name", async (c) => {
  const name = c.req.param("name");
  const lines = Number(c.req.query("lines") ?? 300);
  const { tentacle, output } = await snapshotForTentacle(name, lines);
  if (!tentacle) return c.json({ error: "not found" }, 404);
  return c.json({ tentacle, output });
});

app.get("/api/stream", (c) => {
  return streamSSE(c, async (stream) => {
    let alive = true;
    const onAbort = () => {
      alive = false;
    };
    c.req.raw.signal.addEventListener("abort", onAbort);

    while (alive) {
      try {
        const snap = await buildSnapshot();
        await stream.writeSSE({ event: "state", data: JSON.stringify(snap) });
      } catch (err) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: (err as Error).message }),
        });
      }
      await stream.sleep(POLL_MS);
    }
  });
});

app.get("/api/stream/pane/:name", (c) => {
  const name = c.req.param("name");
  return streamSSE(c, async (stream) => {
    let alive = true;
    c.req.raw.signal.addEventListener("abort", () => {
      alive = false;
    });
    while (alive) {
      try {
        const { tentacle, output } = await snapshotForTentacle(name, 300);
        if (!tentacle) {
          await stream.writeSSE({ event: "gone", data: "{}" });
          break;
        }
        await stream.writeSSE({
          event: "pane",
          data: JSON.stringify({ tentacle, output }),
        });
      } catch (err) {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: (err as Error).message }),
        });
      }
      await stream.sleep(POLL_MS);
    }
  });
});

app.post("/api/panes/:name/send", async (c) => {
  const name = c.req.param("name");
  const body = await c.req.json().catch(() => null);
  const mode: "text" | "key" = body?.mode === "key" ? "key" : "text";
  const text: string | undefined = body?.text;
  const enter: boolean = body?.enter ?? true;

  if (mode === "text" && typeof text !== "string") {
    return c.json({ error: "missing text" }, 400);
  }
  if (mode === "key") {
    if (typeof text !== "string" || !isValidKey(text)) {
      return c.json({ error: "invalid key" }, 400);
    }
  }

  try {
    const { tentacle } = await snapshotForTentacle(name, 5);
    if (!tentacle) return c.json({ error: "unknown tentacle" }, 404);
    if (!tentacle.livePaneId) return c.json({ error: "tentacle has no live pane" }, 409);
    if (mode === "key") {
      await sendKey(tentacle.livePaneId, text!);
    } else {
      await sendKeys(tentacle.livePaneId, text!, enter);
    }
    return c.json({ ok: true, paneId: tentacle.livePaneId });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// Spawn + shutdown drive Claude Code's built-in slash-command mechanism
// instead of a separate queue-file pipeline. On spawn we type `/spawn <args>`
// into the team-lead's tmux pane — the `/spawn` slash command
// (~/UnforcedAGI/.claude/commands/spawn.md) tells that Claude session to
// invoke the Agent tool. Shutdown is tty-direct: we type `/exit` into the
// target tentacle's pane; Claude Code responds by shutting down the session.

const NAME_RX = /^[a-z][a-z0-9-]{1,30}$/;

// Directories searched for spawn-target cwd suggestions. Override with
// OCTOPUS_SPAWN_TARGETS (colon-separated absolute paths). Defaults to the
// current working directory and its parent — sensible "siblings of this repo".
const SPAWN_TARGET_ROOTS = resolveSpawnTargetRoots();

async function listDirs(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => join(root, e.name));
  } catch {
    return [];
  }
}

// Resolve the team-lead's live pane via primary-session detection — same
// signal the dashboard uses for its hero card. Returns null if the team-lead
// pane can't be identified right now (e.g. the primary session isn't in
// tmux or the signals are momentarily absent during a slash dispatch).
async function findTeamLeadPane(): Promise<string | null> {
  const panes = await listPanes();
  for (const p of panes) {
    const content = await capturePane(p.paneId, 40);
    if (isPrimarySessionPane(content)) return p.paneId;
  }
  return null;
}

app.get("/api/spawn-targets", async (c) => {
  const lists = await Promise.all(SPAWN_TARGET_ROOTS.map(listDirs));
  // Include the container roots themselves as valid targets — tentacles can
  // work across sibling repos from a parent directory.
  const targets = [...SPAWN_TARGET_ROOTS, ...lists.flat()];
  return c.json({ targets: Array.from(new Set(targets)).sort() });
});

// Loose git URL check — https://host/org/repo(.git), http variant, git@host:org/repo(.git),
// or git+ssh://host/org/repo. `git clone` enforces the rest.
const GIT_URL_RX = /^(https?:\/\/\S+|git@[^:\s]+:\S+|git(\+ssh)?:\/\/\S+)$/;

async function cloneRepo(url: string, dest: string): Promise<{ ok: true } | { ok: false; stderr: string }> {
  const proc = Bun.spawn(["git", "clone", url, dest], {
    stdout: "pipe",
    stderr: "pipe",
    signal: AbortSignal.timeout(60_000),
  });
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code === 0) return { ok: true };
  return { ok: false, stderr: stderr.trim() || `git clone exited with code ${code}` };
}

app.post("/api/spawn", async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  const cwdRaw = String(body?.cwd ?? "").trim();
  const promptRaw = String(body?.prompt ?? "").trim();
  const cloneUrl = String(body?.cloneUrl ?? "").trim();

  if (!NAME_RX.test(name)) {
    return c.json({ error: "invalid name (lowercase letters/digits/dashes, 2-31 chars, must start with letter)" }, 400);
  }
  if (!cwdRaw || !cwdRaw.startsWith("/")) {
    return c.json({ error: "cwd must be an absolute path" }, 400);
  }
  // Normalize before embedding in the slash command so `/foo//bar` and `/foo/./bar`
  // arrive at the team-lead canonicalized — matches the CLI's spawn behavior.
  const cwd = resolvePath(cwdRaw);

  let cwdExists = false;
  try {
    const st = await stat(cwd);
    if (!st.isDirectory()) return c.json({ error: "cwd exists but is not a directory" }, 400);
    cwdExists = true;
  } catch {
    // cwdExists stays false; clone step below decides what to do.
  }

  if (!cwdExists) {
    if (!cloneUrl) {
      return c.json({ error: "cwd does not exist (provide a git URL in 'Clone from' to clone it)" }, 400);
    }
    if (!GIT_URL_RX.test(cloneUrl)) {
      return c.json({ error: "clone URL does not look like a git URL" }, 400);
    }
    const result = await cloneRepo(cloneUrl, cwd);
    if (!result.ok) {
      return c.json({ error: `git clone failed: ${result.stderr}` }, 400);
    }
  }

  // Reject duplicates against the current roster.
  try {
    const config = await loadConfig();
    if (config.members.some((m) => m.name === name)) {
      return c.json({ error: "a tentacle with that name already exists" }, 409);
    }
  } catch {
    // If config can't load, let the request proceed — the team-lead will surface it.
  }

  const teamLeadPane = await findTeamLeadPane();
  if (!teamLeadPane) {
    return c.json({ error: "team-lead pane not found (primary session not detected)" }, 503);
  }

  // Slash-command $ARGUMENTS receives everything after the command name as a
  // single string. Newlines in the prompt would cause the tty to submit early,
  // so we flatten whitespace. Multi-line briefs still go via SendMessage after
  // the spawn lands.
  const prompt = promptRaw.replace(/\s+/g, " ").trim();
  const command = `/spawn ${name} ${cwd}${prompt ? ` ${prompt}` : ""}`;
  try {
    await sendKeys(teamLeadPane, command, true);
  } catch (err) {
    return c.json({ error: `typing to team-lead failed: ${(err as Error).message}` }, 500);
  }

  return c.json({ ok: true, typedTo: teamLeadPane, command: `/spawn ${name} …` }, 202);
});

app.post("/api/shutdown/:name", async (c) => {
  const name = c.req.param("name");
  const { tentacle } = await snapshotForTentacle(name, 5).catch(() => ({ tentacle: null }));
  if (!tentacle) return c.json({ error: "unknown tentacle" }, 404);
  if (!tentacle.livePaneId) return c.json({ error: "tentacle has no live pane" }, 409);

  try {
    await sendKeys(tentacle.livePaneId, "/exit", true);
  } catch (err) {
    return c.json({ error: `tmux send failed: ${(err as Error).message}` }, 500);
  }
  return c.json({ ok: true, method: "tmux" });
});

app.get("/favicon.svg", (c) => {
  c.header("Content-Type", "image/svg+xml");
  // Abstract octopus glyph stroked in nightForest. Chunkier strokes than the
  // in-page glyph so it still reads at 16x16 browser-tab size.
  // Strokes thickened from 3.6→5 (tentacles) and 4→5 (head) so the silhouette
  // still reads at 16x16 in a browser tab.
  return c.body(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="#7AB09D" stroke-linecap="round" stroke-linejoin="round"><path d="M18 28 C18 14 26 8 32 8 S46 14 46 28 V32 C46 34 44 36 42 36 H22 C20 36 18 34 18 32 Z" stroke-width="5"/><circle cx="27" cy="22" r="2.5" fill="#7AB09D" stroke="none"/><circle cx="37" cy="22" r="2.5" fill="#7AB09D" stroke="none"/><path d="M22 36 C20 46 14 50 18 60" stroke-width="5"/><path d="M30 36 C31 46 26 54 30 60" stroke-width="5"/><path d="M34 36 C33 46 38 54 34 60" stroke-width="5"/><path d="M42 36 C44 46 50 50 46 60" stroke-width="5"/></svg>`,
  );
});

app.get("/styles.css", serveStatic({ path: join(PUBLIC_DIR, "styles.css") }));
app.get("/app.js", serveStatic({ path: join(PUBLIC_DIR, "app.js") }));
app.get("/pane.js", serveStatic({ path: join(PUBLIC_DIR, "pane.js") }));

function renderError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return `<!doctype html><html><head><title>Octopus error</title><link rel="stylesheet" href="/styles.css"></head>
<body><main class="dashboard"><div class="empty"><div class="empty-glyph">⚠️</div><h2>Something broke</h2><pre>${escapeHtml(msg)}</pre></div></main></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

export { app };

// Allow import without auto-starting (for tests)
const isMain = import.meta.main;
if (isMain) {
  console.log(`🐙 octopus → http://${HOST}:${PORT}  (team: ${TEAM_NAME}, config: ${TEAM_CONFIG_PATH})`);
  Bun.serve({ fetch: app.fetch, port: PORT, hostname: HOST, idleTimeout: 0 });
}
