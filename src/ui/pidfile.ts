// PID-file + port-probe helpers for managing the UI process lifecycle.
//
// The CLI uses these to detect whether another octopus UI is already running
// before binding (so `octopus ui` can no-op politely on EADDRINUSE), and to
// implement `octopus ui stop` cleanly.
//
// The PID file lives under XDG state ($XDG_STATE_HOME or ~/.local/state) so
// it survives across shells but is clearly transient state, not config.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export type UiMode = "tmux" | "daemon" | "foreground";

export interface UiPidRecord {
  pid: number;
  host: string;
  port: number;
  startedAt: string;
  /**
   * How this UI was launched. Drives messaging in `ui stop` / `ui status`:
   *   - "tmux"       — owned by an `octopus launch` tmux session
   *   - "daemon"     — backgrounded by `octopus ui` (the default)
   *   - "foreground" — running attached to a terminal (`octopus ui --foreground`)
   */
  mode: UiMode;
  /** When mode === "tmux", the tmux session that owns this UI. */
  tmuxSession?: string;
}

export function pidFilePath(): string {
  const xdg = process.env.XDG_STATE_HOME?.trim();
  const root = xdg && xdg.length > 0 ? xdg : join(homedir(), ".local", "state");
  return join(root, "octopus", "ui.pid");
}

export function readPidFile(path = pidFilePath()): UiPidRecord | null {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const data = JSON.parse(raw) as Partial<UiPidRecord>;
    if (
      typeof data.pid !== "number" ||
      typeof data.host !== "string" ||
      typeof data.port !== "number" ||
      typeof data.startedAt !== "string"
    ) {
      return null;
    }
    const mode: UiMode =
      data.mode === "tmux" || data.mode === "daemon" || data.mode === "foreground"
        ? data.mode
        : "foreground";
    return {
      pid: data.pid,
      host: data.host,
      port: data.port,
      startedAt: data.startedAt,
      mode,
      ...(typeof data.tmuxSession === "string" ? { tmuxSession: data.tmuxSession } : {}),
    };
  } catch {
    return null;
  }
}

export function writePidFile(record: UiPidRecord, path = pidFilePath()): void {
  mkdirSync(dirname(path), { recursive: true });
  // Atomic-ish: write to .tmp then rename, so a crash mid-write can't leave
  // a half-written file that parses but lies.
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(record, null, 2));
  renameSync(tmp, path);
}

export function removePidFile(path = pidFilePath()): void {
  if (existsSync(path)) rmSync(path, { force: true });
}

/** Returns true if a process with the given PID is currently alive. */
export function isProcessAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // ESRCH = no such process; EPERM = exists but we can't signal it (still alive).
    return (err as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * TCP-probe a host:port. Resolves true if something accepted the connection
 * within the timeout. Used as a cheap "is the port held?" check before we
 * even try to identify the holder.
 */
export async function isPortHeld(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  const { connect } = await import("node:net");
  return new Promise<boolean>((resolve) => {
    // Connecting to 0.0.0.0 is undefined on some stacks; probe loopback instead.
    const probeHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
    const socket = connect({ host: probeHost, port, timeout: timeoutMs });
    let settled = false;
    const done = (held: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(held);
    };
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

/**
 * Hits the UI's /api/health endpoint and returns the parsed body if it
 * responds and self-identifies as an octopus UI. Returns null otherwise —
 * either the port is held by something else, or by an older octopus build
 * that lacks the endpoint.
 */
export async function probeOctopusUi(
  host: string,
  port: number,
  timeoutMs = 800,
): Promise<{ pid: number } | null> {
  const probeHost = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`http://${probeHost}:${port}/api/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const body = (await res.json()) as { name?: string; pid?: number };
    if (body?.name !== "octopus-ui" || typeof body.pid !== "number") return null;
    return { pid: body.pid };
  } catch {
    return null;
  }
}
