import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createServer, type Server } from "node:net";
import { join } from "node:path";
import {
  isPortHeld,
  isProcessAlive,
  pidFilePath,
  probeOctopusUi,
  readPidFile,
  removePidFile,
  writePidFile,
  type UiPidRecord,
} from "../src/ui/pidfile.ts";

describe("pidFilePath", () => {
  let savedXdg: string | undefined;
  beforeEach(() => {
    savedXdg = process.env.XDG_STATE_HOME;
  });
  afterEach(() => {
    if (savedXdg === undefined) delete process.env.XDG_STATE_HOME;
    else process.env.XDG_STATE_HOME = savedXdg;
  });

  test("uses XDG_STATE_HOME when set", () => {
    process.env.XDG_STATE_HOME = "/tmp/xdg-state";
    expect(pidFilePath()).toBe("/tmp/xdg-state/octopus/ui.pid");
  });

  test("falls back to ~/.local/state when XDG unset", () => {
    delete process.env.XDG_STATE_HOME;
    expect(pidFilePath()).toMatch(/\/\.local\/state\/octopus\/ui\.pid$/);
  });

  test("treats empty XDG_STATE_HOME as unset", () => {
    process.env.XDG_STATE_HOME = "  ";
    expect(pidFilePath()).toMatch(/\/\.local\/state\/octopus\/ui\.pid$/);
  });
});

describe("write/read/remove PID file", () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "octopus-pid-"));
    path = join(dir, "ui.pid");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  test("round-trips a record", () => {
    const record: UiPidRecord = {
      pid: 12345,
      host: "0.0.0.0",
      port: 6061,
      startedAt: "2026-04-15T10:00:00.000Z",
      mode: "daemon",
    };
    writePidFile(record, path);
    expect(readPidFile(path)).toEqual(record);
  });

  test("preserves tmuxSession when present", () => {
    const record: UiPidRecord = {
      pid: 999,
      host: "127.0.0.1",
      port: 6061,
      startedAt: "2026-04-15T10:00:00.000Z",
      mode: "tmux",
      tmuxSession: "octopus",
    };
    writePidFile(record, path);
    expect(readPidFile(path)?.tmuxSession).toBe("octopus");
  });

  test("returns null on missing file", () => {
    expect(readPidFile(path)).toBeNull();
  });

  test("returns null on garbage JSON", () => {
    writeFileSync(path, "not json");
    expect(readPidFile(path)).toBeNull();
  });

  test("returns null when required fields missing", () => {
    writeFileSync(path, JSON.stringify({ pid: 1 }));
    expect(readPidFile(path)).toBeNull();
  });

  test("defaults missing/invalid mode to 'foreground'", () => {
    writeFileSync(
      path,
      JSON.stringify({ pid: 1, host: "x", port: 1, startedAt: "t" }),
    );
    expect(readPidFile(path)?.mode).toBe("foreground");
    writeFileSync(
      path,
      JSON.stringify({ pid: 1, host: "x", port: 1, startedAt: "t", mode: "bogus" }),
    );
    expect(readPidFile(path)?.mode).toBe("foreground");
  });

  test("write is atomic — readable JSON exists at target", () => {
    writePidFile(
      { pid: 1, host: "x", port: 1, startedAt: "t", mode: "daemon" },
      path,
    );
    expect(JSON.parse(readFileSync(path, "utf8")).pid).toBe(1);
  });

  test("remove is idempotent", () => {
    removePidFile(path);
    writePidFile({ pid: 1, host: "x", port: 1, startedAt: "t", mode: "daemon" }, path);
    removePidFile(path);
    removePidFile(path);
    expect(readPidFile(path)).toBeNull();
  });
});

describe("isProcessAlive", () => {
  test("true for our own PID", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  test("false for an obviously bogus PID", () => {
    expect(isProcessAlive(0)).toBe(false);
    expect(isProcessAlive(-1)).toBe(false);
    // PID 999999 is almost certainly not in use.
    expect(isProcessAlive(999999)).toBe(false);
  });
});

describe("isPortHeld + probeOctopusUi", () => {
  let server: Server | null = null;
  let port = 0;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((r) => server!.close(() => r()));
      server = null;
    }
  });

  test("isPortHeld false when nothing is listening", async () => {
    expect(await isPortHeld("127.0.0.1", 1, 200)).toBe(false);
  });

  test("isPortHeld true when something is listening", async () => {
    server = createServer();
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
    expect(await isPortHeld("127.0.0.1", port, 500)).toBe(true);
  });

  test("probeOctopusUi returns null for non-octopus listener", async () => {
    server = createServer((sock) => sock.end());
    await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
    port = (server.address() as { port: number }).port;
    expect(await probeOctopusUi("127.0.0.1", port, 300)).toBeNull();
  });

  test("probeOctopusUi returns null when nothing is listening", async () => {
    expect(await probeOctopusUi("127.0.0.1", 1, 200)).toBeNull();
  });
});
