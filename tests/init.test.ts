import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

  test("writes all four template files into a fresh directory", async () => {
    await runInit(["--cwd", tmpRoot]);
    expect(existsSync(join(tmpRoot, ".claude/commands/spawn.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/commands/report.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/agents/tentacle.md"))).toBe(true);
    expect(existsSync(join(tmpRoot, ".claude/agents/reviewer.md"))).toBe(true);
  });

  test("does not write .claude/octopus.md (replaced by inline)", async () => {
    await runInit(["--cwd", tmpRoot]);
    expect(existsSync(join(tmpRoot, ".claude/octopus.md"))).toBe(false);
  });

  test("creates CLAUDE.md with fenced octopus section when none exists", async () => {
    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("<!-- octopus:start -->");
    expect(claudeMd).toContain("<!-- octopus:end -->");
    expect(claudeMd).toContain("# Octopus");
  });

  test("updates fenced section in place on re-run", async () => {
    await runInit(["--cwd", tmpRoot]);
    // Simulate user adding content after the section
    const first = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    writeFileSync(join(tmpRoot, "CLAUDE.md"), first + "\n# My project\n\nCustom stuff.\n");

    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    // Fenced section exists exactly once
    const starts = claudeMd.split("<!-- octopus:start -->").length - 1;
    expect(starts).toBe(1);
    // User content preserved
    expect(claudeMd).toContain("# My project");
    expect(claudeMd).toContain("Custom stuff.");
  });

  test("migrates legacy @link to inline section", async () => {
    const legacy =
      "@.claude/octopus.md\n\n" +
      "<!-- Octopus team conventions are loaded above. Add project-specific\n" +
      "     guidance for tentacles and the team-lead below. -->\n";
    writeFileSync(join(tmpRoot, "CLAUDE.md"), legacy);
    // Also create the old .claude/octopus.md so it can be cleaned up
    mkdirSync(join(tmpRoot, ".claude"), { recursive: true });
    writeFileSync(join(tmpRoot, ".claude/octopus.md"), "old content");

    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).not.toContain("@.claude/octopus.md");
    expect(claudeMd).toContain("<!-- octopus:start -->");
    expect(claudeMd).toContain("# Octopus");
    // Legacy file removed
    expect(existsSync(join(tmpRoot, ".claude/octopus.md"))).toBe(false);
  });

  test("migrates legacy @link and preserves user content below it", async () => {
    const legacy =
      "@.claude/octopus.md\n\n" +
      "<!-- Octopus team conventions are loaded above. Add project-specific\n" +
      "     guidance for tentacles and the team-lead below. -->\n\n" +
      "# My repo\n\nImportant stuff.\n";
    writeFileSync(join(tmpRoot, "CLAUDE.md"), legacy);

    await runInit(["--cwd", tmpRoot]);
    const claudeMd = readFileSync(join(tmpRoot, "CLAUDE.md"), "utf8");
    expect(claudeMd).toContain("<!-- octopus:start -->");
    expect(claudeMd).toContain("# My repo");
    expect(claudeMd).toContain("Important stuff.");
  });

  test("template files match the source files verbatim", async () => {
    await runInit(["--cwd", tmpRoot]);
    const writtenSpawn = readFileSync(join(tmpRoot, ".claude/commands/spawn.md"), "utf8");
    expect(writtenSpawn).toContain("Spawn tentacle");
    expect(writtenSpawn).toContain("$ARGUMENTS");
  });
});
