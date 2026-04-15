import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { tmuxHasSession, which } from "./tmux.ts";

export interface LaunchArgOptions {
  team: string;
  cwd: string;
  session: string;
  model: string;
  skipPermissions: boolean;
  resume?: string;
  continueSession?: boolean;
}

// Pure helper: build the argv for `tmux new-session … claude …`. Extracted so
// tests can assert the shape of the claude invocation without spawning tmux.
export function buildClaudeLaunchArgs(opts: LaunchArgOptions): string[] {
  const args = [
    "tmux",
    "new-session",
    "-d",
    "-s",
    opts.session,
    "-c",
    opts.cwd,
    "-e",
    `OCTOPUS_TEAM=${opts.team}`,
    "claude",
  ];
  if (opts.skipPermissions) args.push("--dangerously-skip-permissions");
  if (opts.model) args.push("--model", opts.model);
  if (opts.continueSession) args.push("--continue");
  if (opts.resume) args.push("--resume", opts.resume);
  return args;
}

export async function runLaunch(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, [
    "team",
    "cwd",
    "session",
    "model",
    "no-skip-permissions",
    "resume",
    "continue",
  ]);
  const team = (flags.team as string) ?? process.env.OCTOPUS_TEAM ?? "octopus";
  const cwd = resolve((flags.cwd as string) ?? process.cwd());
  const session = (flags.session as string) ?? team;
  const model = (flags.model as string) ?? "";
  const skipPermissions =
    !flags["no-skip-permissions"] &&
    process.env.OCTOPUS_SKIP_PERMISSIONS !== "false";

  const continueSession = flags["continue"] === true;
  const resume = typeof flags.resume === "string" ? flags.resume : undefined;
  if (continueSession && resume) {
    console.error("error: --continue and --resume are mutually exclusive.");
    console.error("Use --continue for the most recent session, --resume <id> for a specific one.");
    process.exit(1);
  }

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
    if (continueSession || resume) {
      console.warn(
        `note: tmux session "${session}" is already running — attach flags (--continue / --resume) are ignored.`,
      );
      console.warn(`To start a fresh claude with resume, kill the session first: tmux kill-session -t ${session}`);
    }
    console.log(`attaching to existing tmux session "${session}"`);
  } else {
    const claudeArgs = buildClaudeLaunchArgs({
      team,
      cwd,
      session,
      model,
      skipPermissions,
      resume,
      continueSession,
    });
    const create = Bun.spawnSync(claudeArgs, { stdout: "inherit", stderr: "inherit" });
    if (create.exitCode !== 0) {
      console.error("error: failed to create tmux session.");
      process.exit(create.exitCode ?? 1);
    }
    const resumeNote = continueSession
      ? " (resuming most recent session)"
      : resume
        ? ` (resuming session ${resume.slice(0, 8)}…)`
        : "";
    console.log(`started octopus team "${team}" in tmux session "${session}" (cwd: ${cwd})${resumeNote}`);
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
