import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { buildClaudeLaunchArgs } from "../src/cli/launch.ts";

const CLI = resolve(import.meta.dir, "../src/cli.ts");

describe("buildClaudeLaunchArgs", () => {
  const base = {
    team: "octopus",
    cwd: "/tmp/proj",
    session: "octopus",
    model: "",
    skipPermissions: true,
  };

  test("includes --continue when continueSession is set", () => {
    const args = buildClaudeLaunchArgs({ ...base, continueSession: true });
    expect(args).toContain("--continue");
  });

  test("includes --resume <id> when resume is set", () => {
    const args = buildClaudeLaunchArgs({ ...base, resume: "abc-123" });
    const idx = args.indexOf("--resume");
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe("abc-123");
  });

  test("omits both flags by default", () => {
    const args = buildClaudeLaunchArgs(base);
    expect(args).not.toContain("--continue");
    expect(args).not.toContain("--resume");
  });

  test("model + skipPermissions + continue all stack", () => {
    const args = buildClaudeLaunchArgs({
      ...base,
      model: "claude-sonnet-4-6",
      continueSession: true,
    });
    expect(args).toContain("--dangerously-skip-permissions");
    expect(args).toContain("--model");
    expect(args).toContain("claude-sonnet-4-6");
    expect(args).toContain("--continue");
  });

  test("--continue + --resume together exits with a helpful error", async () => {
    const proc = Bun.spawn(["bun", CLI, "launch", "--continue", "--resume", "abc"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const code = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(code).toBe(1);
    expect(stderr).toContain("mutually exclusive");
  });

  test("uses `claude` as the launched binary after tmux new-session flags", () => {
    const args = buildClaudeLaunchArgs(base);
    const claudeIdx = args.indexOf("claude");
    expect(claudeIdx).toBeGreaterThan(-1);
    // --continue / --resume must come after the `claude` token so they reach
    // the Claude Code CLI, not tmux.
    const argsAfterClaude = buildClaudeLaunchArgs({ ...base, continueSession: true }).slice(claudeIdx + 1);
    expect(argsAfterClaude).toContain("--continue");
  });
});
