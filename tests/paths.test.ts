import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveTeamConfigPath } from "../src/paths.ts";

describe("resolveTeamConfigPath", () => {
  test("explicit override wins over discovery", () => {
    const got = resolveTeamConfigPath("octopus", "/tmp/explicit/config.json");
    expect(got).toBe("/tmp/explicit/config.json");
  });

  test("project-local beats home-dir when present", () => {
    // realpathSync — macOS symlinks /var → /private/var, and process.cwd()
    // returns the canonical (private) form.
    const tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), "octopus-paths-test-")));
    try {
      const local = join(tmpRoot, ".claude/teams/octopus/config.json");
      mkdirSync(join(tmpRoot, ".claude/teams/octopus"), { recursive: true });
      writeFileSync(local, "{}");
      const oldCwd = process.cwd();
      try {
        process.chdir(tmpRoot);
        const got = resolveTeamConfigPath("octopus");
        expect(got).toBe(local);
      } finally {
        process.chdir(oldCwd);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test("falls back to home-dir path when neither override nor project-local exist", () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), "octopus-paths-test-"));
    try {
      const oldCwd = process.cwd();
      try {
        process.chdir(tmpRoot);
        const got = resolveTeamConfigPath("octopus");
        expect(got).toContain(".claude/teams/octopus/config.json");
        expect(got).not.toBe(join(tmpRoot, ".claude/teams/octopus/config.json"));
      } finally {
        process.chdir(oldCwd);
      }
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
