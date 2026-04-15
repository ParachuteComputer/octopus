import { describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  encodeProjectCwd,
  formatDuration,
  formatSessionsList,
  formatTimestamp,
  listSessions,
} from "../src/cli/sessions.ts";

describe("encodeProjectCwd", () => {
  test("replaces all slashes with dashes", () => {
    expect(encodeProjectCwd("/Users/alice/code/foo")).toBe("-Users-alice-code-foo");
  });
  test("leaves dash-free relative paths alone-ish", () => {
    expect(encodeProjectCwd("relative")).toBe("relative");
  });
});

describe("formatDuration", () => {
  test("seconds", () => {
    expect(formatDuration(4_000)).toBe("4 sec of context");
  });
  test("minutes", () => {
    expect(formatDuration(30 * 60 * 1000)).toBe("30 min of context");
  });
  test("hours (with fractional)", () => {
    expect(formatDuration(2.5 * 60 * 60 * 1000)).toBe("2.5 hours of context");
  });
  test("hours (rounded when > 10h)", () => {
    expect(formatDuration(24 * 60 * 60 * 1000)).toBe("24 hours of context");
  });
  test("negative returns dash", () => {
    expect(formatDuration(-5)).toBe("—");
  });
});

describe("formatTimestamp", () => {
  test("returns YYYY-MM-DD HH:MM shape", () => {
    const s = formatTimestamp("2026-04-15T17:43:00.000Z");
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
  test("falls back to the raw value on garbage", () => {
    expect(formatTimestamp("not-a-date")).toBe("not-a-date");
  });
});

describe("listSessions", () => {
  test("reads session metadata from jsonl files in the encoded project dir", async () => {
    const root = await mkdtemp(join(tmpdir(), "octopus-sessions-"));
    const projectCwd = "/tmp/test-project-xyz";
    const projectDir = join(root, encodeProjectCwd(projectCwd));
    await mkdir(projectDir, { recursive: true });

    // Session A — 30 min of activity
    await writeFile(
      join(projectDir, "aaaa-1111.jsonl"),
      [
        JSON.stringify({ type: "system", timestamp: "2026-04-15T10:00:00.000Z" }),
        JSON.stringify({ type: "user", content: "hi", timestamp: "2026-04-15T10:05:00.000Z" }),
        JSON.stringify({ type: "assistant", content: "ok", timestamp: "2026-04-15T10:30:00.000Z" }),
      ].join("\n"),
    );

    // Session B — most recent, 2 hours of activity
    await writeFile(
      join(projectDir, "bbbb-2222.jsonl"),
      [
        JSON.stringify({ type: "system", timestamp: "2026-04-15T14:00:00.000Z" }),
        JSON.stringify({ type: "user", content: "hi", timestamp: "2026-04-15T16:00:00.000Z" }),
      ].join("\n"),
    );

    // Non-jsonl: should be ignored.
    await writeFile(join(projectDir, "README.md"), "ignored");

    const sessions = await listSessions(projectCwd, root);
    expect(sessions).toHaveLength(2);
    // Sorted by last-activity desc — session B (16:00) first
    expect(sessions[0]?.id).toBe("bbbb-2222");
    expect(sessions[1]?.id).toBe("aaaa-1111");
    expect(sessions[0]?.firstTimestamp).toBe("2026-04-15T14:00:00.000Z");
    expect(sessions[0]?.lastTimestamp).toBe("2026-04-15T16:00:00.000Z");
    expect(sessions[0]?.durationMs).toBe(2 * 60 * 60 * 1000);

    await rm(root, { recursive: true, force: true });
  });

  test("returns empty list when the project dir doesn't exist", async () => {
    const sessions = await listSessions("/nonexistent/path/abc", "/tmp/definitely-not-here-xyz");
    expect(sessions).toEqual([]);
  });
});

describe("formatSessionsList", () => {
  test("friendly empty message", () => {
    const out = formatSessionsList([]);
    expect(out).toContain("No Claude Code sessions found");
    expect(out).toContain("octopus launch");
  });

  test("includes id, last-touched, duration, and the resume hints", () => {
    const out = formatSessionsList([
      {
        id: "abcd-1234",
        path: "/fake",
        firstTimestamp: "2026-04-15T14:00:00.000Z",
        lastTimestamp: "2026-04-15T16:00:00.000Z",
        durationMs: 2 * 60 * 60 * 1000,
        sizeBytes: 1024,
      },
    ]);
    expect(out).toContain("abcd-1234");
    expect(out).toContain("2.0 hours of context");
    expect(out).toContain("octopus launch --continue");
    expect(out).toContain("octopus launch --resume <session-id>");
  });
});
