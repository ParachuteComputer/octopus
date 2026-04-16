import { describe, expect, test } from "bun:test";
import { app } from "../src/ui/server.tsx";
import { extractMentions } from "../src/ui/state.ts";
import { isPrimarySessionPane, isValidKey } from "../src/ui/tmux.ts";

describe("octopus server", () => {
  test("health returns ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  test("dashboard renders HTML shell", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Octopus");
    expect(html).toContain('href="/styles.css"');
    // May render the dashboard (app.js + stat-label) or pod overview page
    // depending on pod.json state. Both are valid HTML shells.
    expect(html.includes('src="/app.js"') || html.includes("pod-grid")).toBe(true);
  });

  test("/api/state returns a snapshot object", async () => {
    const res = await app.request("/api/state");
    expect(res.status).toBe(200);
    const snap = (await res.json()) as {
      team: string;
      tentacles: unknown[];
      totalMembers: number;
    };
    expect(typeof snap.team).toBe("string");
    expect(Array.isArray(snap.tentacles)).toBe(true);
    expect(typeof snap.totalMembers).toBe("number");
  });

  test("POST send requires text", async () => {
    const res = await app.request("/api/panes/whatever/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("missing text");
  });

  test("POST send 404s unknown tentacle", async () => {
    const res = await app.request("/api/panes/__definitely_not_real__/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    });
    expect(res.status).toBe(404);
  });

  test("pane page 404s for unknown tentacle", async () => {
    const res = await app.request("/pane/__definitely_not_real__");
    expect(res.status).toBe(404);
  });

  test("POST send mode:key rejects unknown keys", async () => {
    const res = await app.request("/api/panes/anything/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "key", text: "rm -rf /" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid key");
  });
});

describe("primary-session detection", () => {
  test("matches on teammates strip", () => {
    expect(isPrimarySessionPane("@main @daily-ux @vault-tidy → next")).toBe(true);
  });

  test("matches on numeric teammate count badge", () => {
    expect(isPrimarySessionPane("status · 4 teammates · idle")).toBe(true);
  });

  test("does not match a tentacle banner", () => {
    expect(isPrimarySessionPane("── @octopus-polish ──\nworking")).toBe(false);
  });
});

describe("extractMentions", () => {
  const known = new Set(["alpha", "bravo", "charlie"]);

  test("extracts known names only and excludes @main", () => {
    const content = "spawning @alpha and @bravo and @anthropic and @main";
    expect(extractMentions(content, known).sort()).toEqual(["alpha", "bravo"]);
  });

  test("returns empty when nothing matches", () => {
    expect(extractMentions("nothing here", known)).toEqual([]);
  });
});

describe("isValidKey", () => {
  test("accepts standard tmux key names", () => {
    expect(isValidKey("Escape")).toBe(true);
    expect(isValidKey("C-c")).toBe(true);
    expect(isValidKey("Up")).toBe(true);
    expect(isValidKey("BTab")).toBe(true);
    expect(isValidKey("PageDown")).toBe(true);
  });

  test("rejects arbitrary text", () => {
    expect(isValidKey("ls -la")).toBe(false);
    expect(isValidKey("")).toBe(false);
    expect(isValidKey("F1")).toBe(false);
  });
});

describe("spawn endpoint", () => {
  test("rejects invalid name", async () => {
    const res = await app.request("/api/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad Name", cwd: "/tmp", prompt: "hi" }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("invalid name");
  });

  test("rejects relative cwd", async () => {
    const res = await app.request("/api/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "valid-name", cwd: "relative/path", prompt: "hi" }),
    });
    expect(res.status).toBe(400);
  });

  test("rejects non-existent cwd without cloneUrl", async () => {
    const res = await app.request("/api/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "valid-name",
        cwd: "/definitely/not/a/real/path/xyz",
        prompt: "hi",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("does not exist");
  });
});

describe("shutdown endpoint", () => {
  test("404s unknown tentacle", async () => {
    const res = await app.request("/api/shutdown/__definitely_not_real__", {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});

describe("spawn-targets endpoint", () => {
  test("returns a targets array", async () => {
    const res = await app.request("/api/spawn-targets");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { targets: string[] };
    expect(Array.isArray(body.targets)).toBe(true);
  });
});
