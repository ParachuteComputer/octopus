import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseFlags } from "./flags.ts";
import {
  isPortHeld,
  isProcessAlive,
  pidFilePath,
  probeOctopusUi,
  readPidFile,
  removePidFile,
  writePidFile,
  type UiMode,
  type UiPidRecord,
} from "../ui/pidfile.ts";

// Flags accepted by `octopus ui` and friends. Kept in one place so all paths
// (start, stop, restart, the daemon-respawn child) parse consistently.
const UI_FLAGS = [
  "team",
  "team-config",
  "port",
  "host",
  "poll-ms",
  "foreground",
  "tmux-session",
] as const;

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 6061;

interface UiOptions {
  team?: string;
  teamConfig?: string;
  port: number;
  host: string;
  pollMs?: string;
  foreground: boolean;
  tmuxSession?: string;
  /** The flags as originally given on argv, so we can re-pass them to a child. */
  passthroughArgv: string[];
}

function readOptions(argv: string[]): UiOptions {
  const { flags } = parseFlags(argv, [...UI_FLAGS]);
  // Reconstruct a minimal passthrough argv (only the flags we know — drops
  // unrelated tokens, which is fine because there are no positionals here).
  const passthrough: string[] = [];
  for (const name of UI_FLAGS) {
    const v = flags[name];
    if (v === undefined) continue;
    if (v === true) passthrough.push(`--${name}`);
    else passthrough.push(`--${name}`, String(v));
  }
  return {
    team: flags["team"] ? String(flags["team"]) : process.env.OCTOPUS_TEAM,
    teamConfig: flags["team-config"]
      ? String(flags["team-config"])
      : process.env.OCTOPUS_TEAM_CONFIG,
    port: Number(flags["port"] ?? process.env.OCTOPUS_UI_PORT ?? DEFAULT_PORT),
    host: String(flags["host"] ?? process.env.OCTOPUS_UI_HOST ?? DEFAULT_HOST),
    pollMs: flags["poll-ms"] ? String(flags["poll-ms"]) : process.env.OCTOPUS_UI_POLL_MS,
    foreground: flags["foreground"] === true,
    tmuxSession: flags["tmux-session"] ? String(flags["tmux-session"]) : undefined,
    passthroughArgv: passthrough,
  };
}

function applyEnv(opts: UiOptions): void {
  if (opts.team) process.env.OCTOPUS_TEAM = opts.team;
  if (opts.teamConfig) process.env.OCTOPUS_TEAM_CONFIG = opts.teamConfig;
  process.env.OCTOPUS_UI_PORT = String(opts.port);
  process.env.OCTOPUS_UI_HOST = opts.host;
  if (opts.pollMs) process.env.OCTOPUS_UI_POLL_MS = opts.pollMs;
}

function displayUrl(host: string, port: number): string {
  const h = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  return `http://${h}:${port}`;
}

function logFilePath(): string {
  const xdg = process.env.XDG_STATE_HOME?.trim();
  const root = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "state");
  return join(root, "octopus", "ui.log");
}

export async function runUi(argv: string[]): Promise<void> {
  const [first, ...rest] = argv;
  if (first === "stop") return runUiStop(rest);
  if (first === "restart") return runUiRestart(rest);
  if (first === "status") return runUiStatus(rest);
  return runUiStart(argv);
}

async function alreadyRunning(opts: UiOptions): Promise<UiPidRecord | null> {
  const existing = readPidFile();
  if (existing && isProcessAlive(existing.pid)) {
    const probe = await probeOctopusUi(existing.host, existing.port);
    if (probe) return existing;
    // Process alive but not responding — could be mid-startup, mid-shutdown,
    // or genuinely orphaned (e.g. crashed listener, recycled PID). Surface
    // the ambiguity so the user can decide rather than silently spawning a
    // second daemon.
    console.error(
      `warning: PID ${existing.pid} is alive but not responding on ${existing.host}:${existing.port}.`,
    );
    console.error(
      `         the PID file may be stale (different process now); run \`octopus ui stop\` to clear it.`,
    );
  } else if (existing) {
    removePidFile(); // stale
  }
  // Fall back to a port probe in case someone started a UI without writing a
  // PID file (older octopus version, or running directly with `bun src/...`).
  if (await isPortHeld(opts.host, opts.port)) {
    const probe = await probeOctopusUi(opts.host, opts.port);
    if (probe) {
      return {
        pid: probe.pid,
        host: opts.host,
        port: opts.port,
        startedAt: "(unknown — no PID file)",
        mode: "foreground",
      };
    }
    // Port held by something foreign — surfaced as an error in the caller.
    return null;
  }
  return null;
}

async function runUiStart(argv: string[]): Promise<void> {
  const opts = readOptions(argv);

  // 1. If something is already serving as us, don't fight it.
  const running = await alreadyRunning(opts);
  if (running) {
    console.log(
      `🐙 octopus UI already running (pid ${running.pid}, mode ${running.mode}) → ${displayUrl(running.host, running.port)}`,
    );
    if (running.mode === "tmux" && running.tmuxSession) {
      console.log(`   owned by tmux session "${running.tmuxSession}".`);
    } else {
      console.log(`   stop it with: octopus ui stop`);
    }
    return;
  }

  // 2. Foreign-process check: port held but not by an octopus UI.
  if (await isPortHeld(opts.host, opts.port)) {
    console.error(
      `error: port ${opts.port} on ${opts.host} is held by a non-octopus process.`,
    );
    console.error(`Pick a different port with --port, or free the existing one.`);
    process.exit(1);
  }

  // 3. Foreground mode runs the server in this process. Used for dev
  //    (`bun src/cli.ts ui --foreground`) and as the body of the daemon
  //    re-spawn / the tmux-window child.
  if (opts.foreground) {
    return runForeground(opts);
  }

  // 4. Default: daemonize. Spawn ourselves with --foreground and exit so the
  //    user's shell isn't holding the server. Logs go to the state dir.
  await spawnDaemon(opts);
}

async function runForeground(opts: UiOptions): Promise<void> {
  applyEnv(opts);
  const { app } = await import("../ui/server.tsx");

  let server: { stop: (closeActiveConnections?: boolean) => Promise<void> } | undefined;
  try {
    server = Bun.serve({
      fetch: app.fetch,
      port: opts.port,
      hostname: opts.host,
      idleTimeout: 0,
    }) as unknown as { stop: (closeActiveConnections?: boolean) => Promise<void> };
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      const probe = await probeOctopusUi(opts.host, opts.port);
      if (probe) {
        console.log(
          `🐙 octopus UI raced into existence (pid ${probe.pid}) → ${displayUrl(opts.host, opts.port)}`,
        );
        return;
      }
      console.error(`error: port ${opts.port} on ${opts.host} is in use.`);
      process.exit(1);
    }
    throw err;
  }

  const mode: UiMode = opts.tmuxSession
    ? "tmux"
    : process.env.OCTOPUS_UI_DAEMONIZED === "1"
      ? "daemon"
      : "foreground";
  const record: UiPidRecord = {
    pid: process.pid,
    host: opts.host,
    port: opts.port,
    startedAt: new Date().toISOString(),
    mode,
    ...(opts.tmuxSession ? { tmuxSession: opts.tmuxSession } : {}),
  };
  writePidFile(record);

  const cleanup = (signal: string) => {
    removePidFile();
    void server?.stop(true).finally(() => {
      process.exit(signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
    });
  };
  process.on("SIGTERM", () => cleanup("SIGTERM"));
  process.on("SIGINT", () => cleanup("SIGINT"));
  process.on("exit", () => removePidFile());

  console.log(`🐙 octopus → ${displayUrl(opts.host, opts.port)}  (pid ${process.pid}, mode ${mode})`);
  if (opts.host === "0.0.0.0" || opts.host === "::") {
    console.log(`   bound to ${opts.host} — gate at the network layer (Tailscale, firewall).`);
  }
}

async function spawnDaemon(opts: UiOptions): Promise<void> {
  const log = logFilePath();
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, "a");

  // Use Node's spawn for proper detach + unref. Bun.spawn doesn't expose
  // detached: true cleanly across versions.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { spawn } = require("node:child_process") as typeof import("node:child_process");

  const args = [process.argv[1], "ui", "--foreground", ...opts.passthroughArgv];
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", fd, fd],
    env: { ...process.env, OCTOPUS_UI_DAEMONIZED: "1" },
  });
  child.unref();
  // Parent has handed the fd to the child; close our reference so we don't
  // hold an extra one until process exit.
  closeSync(fd);

  // Wait briefly for the child to write its PID file so the user gets a
  // crisp "started" report rather than racing `octopus ui status`.
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    const rec = readPidFile();
    if (rec && rec.pid === child.pid) break;
    await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`🐙 octopus UI starting in background → ${displayUrl(opts.host, opts.port)}`);
  console.log(`   logs: ${log}`);
  console.log(`   pid:  ${child.pid} (manage with: octopus ui status / stop / restart)`);
}

async function runUiStop(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["timeout"]);
  const timeoutMs = Number(flags["timeout"] ?? 3000);

  const record = readPidFile();
  if (!record) {
    console.log("no octopus UI PID file found — nothing to stop.");
    return;
  }

  if (!isProcessAlive(record.pid)) {
    console.log(`stale PID file (pid ${record.pid} no longer running) — cleaning up.`);
    removePidFile();
    if (await isPortHeld(record.host, record.port)) {
      const probe = await probeOctopusUi(record.host, record.port);
      if (probe) {
        console.log(
          `   note: another octopus UI (pid ${probe.pid}) is on ${displayUrl(record.host, record.port)}.`,
        );
      } else {
        console.log(
          `   note: ${record.host}:${record.port} is held by a non-octopus process.`,
        );
      }
    }
    return;
  }

  // PID alive — verify it self-identifies as us before signaling. We treat
  // any failure of the health probe as "do not signal" because PID numbers
  // can be reused by the OS if our previous process crashed without removing
  // the PID file (SIGKILL, OOM, etc.). Trusting the PID file alone risks
  // killing a foreign process that happened to inherit the number.
  const probe = await probeOctopusUi(record.host, record.port);
  if (!probe || probe.pid !== record.pid) {
    if (await isPortHeld(record.host, record.port)) {
      console.error(
        `error: PID ${record.pid} is alive but ${record.host}:${record.port} is held by a non-octopus process.`,
      );
      console.error(`Refusing to kill PID ${record.pid} — please investigate.`);
      process.exit(1);
    }
    console.log(
      `stale-looking PID file: pid ${record.pid} is alive but not responding as an octopus UI on ${record.host}:${record.port}.`,
    );
    console.log(
      `Removing PID file but NOT signaling pid ${record.pid} (could be a recycled PID belonging to a foreign process).`,
    );
    console.log(`If you're sure pid ${record.pid} is the leaked octopus UI, kill it manually.`);
    removePidFile();
    return;
  }

  if (record.mode === "tmux" && record.tmuxSession) {
    console.log(
      `note: this UI is owned by tmux session "${record.tmuxSession}". Killing the bun process — tmux will close the window.`,
    );
    console.log(
      `      (or close it via tmux: \`tmux kill-window -t ${record.tmuxSession}:octopus-ui\`)`,
    );
  }

  try {
    process.kill(record.pid, "SIGTERM");
  } catch (err) {
    console.error(`error: failed to signal pid ${record.pid}: ${(err as Error).message}`);
    process.exit(1);
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(record.pid)) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  if (isProcessAlive(record.pid)) {
    console.error(`pid ${record.pid} did not exit within ${timeoutMs}ms — sending SIGKILL.`);
    try {
      process.kill(record.pid, "SIGKILL");
    } catch {
      // Process may have died between the check and the kill.
    }
  }

  // Wait for the port to actually free.
  const portDeadline = Date.now() + 1000;
  while (Date.now() < portDeadline && (await isPortHeld(record.host, record.port))) {
    await new Promise((r) => setTimeout(r, 100));
  }

  removePidFile();
  console.log(
    `stopped octopus UI (pid ${record.pid}, was on ${displayUrl(record.host, record.port)}).`,
  );
}

async function runUiRestart(argv: string[]): Promise<void> {
  // Forward --timeout to the stop phase so `octopus ui restart --timeout 500`
  // applies that bound to the stop, not just the (ignored) start.
  const { flags } = parseFlags(argv, ["timeout"]);
  const stopArgv = flags["timeout"] ? ["--timeout", String(flags["timeout"])] : [];
  await runUiStop(stopArgv);
  await runUiStart(argv);
}

async function runUiStatus(_argv: string[]): Promise<void> {
  const record = readPidFile();
  if (!record) {
    console.log("no octopus UI running (no PID file).");
    console.log(`   pidfile: ${pidFilePath()}`);
    console.log(`   logs:    ${logFilePath()} ${existsSync(logFilePath()) ? "" : "(none yet)"}`);
    return;
  }
  const alive = isProcessAlive(record.pid);
  const probe = alive ? await probeOctopusUi(record.host, record.port) : null;
  console.log(`pid:        ${record.pid} ${alive ? "(alive)" : "(stale)"}`);
  console.log(`url:        ${displayUrl(record.host, record.port)}`);
  console.log(`mode:       ${record.mode}${record.tmuxSession ? ` (tmux: ${record.tmuxSession})` : ""}`);
  console.log(`startedAt:  ${record.startedAt}`);
  console.log(`responding: ${probe ? "yes" : "no"}`);
  console.log(`pidfile:    ${pidFilePath()}`);
  console.log(`logs:       ${logFilePath()}`);
}

/**
 * Exposed for `octopus launch` to call after creating the tmux session, so
 * the UI window inherits the same lifecycle as the team-lead.
 */
export { logFilePath };
