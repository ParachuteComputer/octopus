import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/cli/init.ts";

describe("octopus init", () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = mkdtempSync(join(tmpdir(), "octopus-init-test-"));
  });

  afterEach(() => {
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  test("writes all four template files + octopus.md into a fresh directory", async () => {
    await runInit(["--cwd", tmpRoot]);
    expect(existsSync(join(tmpRoot, ".claude/commands/spawn.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/commands/report.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/agents/tentacle.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/agents/reviewer.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/octopus.md"))).toBe(true);
  });

  test("creates CLAUDE.md with the @link when none exists", async () => {
    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd.startsWith("@.claude/octopus.md")).toBe(true);
  });

  test("prepends the @link to an existing CLAUDE.md without clobbering it", async () => {
    const existingBody = "# my repo\n\nproject conventions live here.\n";
    writeFileSync(join(tmpRoot, "CLAUDE.md"), existingBody);
    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("@.claude/octopus.md");
    expect(claudeMd).toContain("# my repo");
    expect(claudeMd).toContain("project conventions live here.");
  });

  test("is idempotent — running twice does not duplicate the @link", async () => {
    await runInit(["--cwd", tmpRoot]);
    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    const occurrences = claudeMd.split("@.claude/octopus.md").length - 1;
    expect(occurrences).toBe(1);
  });

  test("template files match the source files verbatim", async () => {
    await runInit(["--cwd", tmpRoot]);
    const writtenSpawn = readFileSync(join(tmpRoot, ".claude/commands/spawn.md"), "utf8");
    expect(writtenSpawn).toContain("Spawn tentacle");
    expect(writtenSpawn).toContain("$ARGUMENTS");
  });
});
