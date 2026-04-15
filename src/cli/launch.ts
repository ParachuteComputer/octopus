import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { tmuxHasSession, which } from "./tmux.ts";

export async function runLaunch(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["team", "cwd", "session", "model"]);
  const team = (flags.team as string) ?? process.env.OCTOPUS_TEAM ?? "octopus";
  const cwd = resolve((flags.cwd as string) ?? process.cwd());
  const session = (flags.session as string) ?? team;
  const model = (flags.model as string) ?? "";

  if (!which("tmux")) {
    console.error("error: tmux is not installed or not on PATH (try `brew install tmux`).");
    process.exit(1);
  }
  if (!which("claude")) {
    console.error("error: `claude` (Claude Code CLI) is not on PATH.");
    console.error("Install Claude Code first: https://docs.claude.com/claude-code");
    process.exit(1);
  }
  if (!existsSync(cwd)) {
    console.error(`error: cwd does not exist: ${cwd}`);
    process.exit(1);
  }

  if (tmuxHasSession(session)) {
    console.log(`attaching to existing tmux session "${session}"`);
  } else {
    const claudeArgs = [
      "tmux",
      "new-session",
      "-d",
      "-s",
      session,
      "-c",
      cwd,
      "claude",
      "--dangerously-skip-permissions",
    ];
    if (model) claudeArgs.push("--model", model);
    const create = Bun.spawnSync(claudeArgs, { stdout: "inherit", stderr: "inherit" });
    if (create.exitCode !== 0) {
      console.error("error: failed to create tmux session.");
      process.exit(create.exitCode ?? 1);
    }
    console.log(`started octopus team "${team}" in tmux session "${session}" (cwd: ${cwd})`);
  }

  const insideTmux = !!process.env.TMUX;
  const attachCmd = insideTmux
    ? ["tmux", "switch-client", "-t", session]
    : ["tmux", "attach-session", "-t", session];
  const attach = Bun.spawn(attachCmd, {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await attach.exited;
  process.exit(code);
}
