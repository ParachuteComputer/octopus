import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import {
  tmuxHasSession,
  tmuxListWindows,
  tmuxNewWindow,
  which,
} from "./tmux.ts";
import {
  isProcessAlive,
  probeOctopusUi,
  readPidFile,
} from "../ui/pidfile.ts";
import { findInstance, findInstanceByScope } from "../pod.ts";

const UI_WINDOW_NAME = "octopus-ui";

export interface LaunchArgOptions {
  team: string;
  cwd: string;
  session: string;
  model: string;
  skipPermissions: boolean;
  resume?: string;
  continueSession?: boolean;
}

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
  const { flags, positional } = parseFlags(argv, [
    "team",
    "cwd",
    "session",
    "model",
    "no-skip-permissions",
    "no-ui",
    "ui-port",
    "ui-host",
    "resume",
    "continue",
  ]);

  // Resolve from pod registry. Three paths:
  // 1. Explicit positional name: `octopus launch parachute` → look up by name
  // 2. No name, no flags: infer from cwd → reverse-lookup the pod registry
  // 3. Explicit --team/--cwd flags override everything
  const podName = positional[0];
  const instanceByName = podName ? findInstance(podName) : undefined;
  const resolvedCwd = resolve((flags.cwd as string) ?? instanceByName?.scope ?? process.cwd());
  const instanceByCwd = !podName && !flags.team ? findInstanceByScope(resolvedCwd) : undefined;
  const instance = instanceByName ?? instanceByCwd;

  if (podName && !instanceByName && !flags.team && !flags.cwd) {
    console.error(`error: "${podName}" is not in the pod registry and no --team/--cwd given.`);
    console.error(`  parachute-octopus pod add ${podName} --scope <dir>    register it first`);
    console.error(`  parachute-octopus launch --team ${podName} --cwd .    or use explicit flags`);
    process.exit(1);
  }

  if (instanceByCwd) {
    console.log(`detected pod "${instanceByCwd.name}" from cwd (${resolvedCwd})`);
  }

  const team = (flags.team as string) ?? instance?.name ?? process.env.OCTOPUS_TEAM ?? "octopus";
  const cwd = resolvedCwd;
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

  // Bring up the UI as a managed window inside the same tmux session, unless
  // disabled. tmux owns the lifecycle: kill the session → window dies → bun
  // dies → PID file cleared by the ui process's SIGTERM handler.
  if (!flags["no-ui"]) {
    await ensureUiWindow({
      session,
      cwd,
      port: flags["ui-port"] ? Number(flags["ui-port"]) : undefined,
      host: flags["ui-host"] ? String(flags["ui-host"]) : undefined,
      team,
    });
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

interface EnsureUiOpts {
  session: string;
  cwd: string;
  port?: number;
  host?: string;
  team: string;
}

async function ensureUiWindow(opts: EnsureUiOpts): Promise<void> {
  const existing = readPidFile();
  if (existing && isProcessAlive(existing.pid)) {
    const probe = await probeOctopusUi(existing.host, existing.port);
    if (probe) {
      console.log(
        `   UI already running (pid ${existing.pid}, mode ${existing.mode}) → http://${existing.host === "0.0.0.0" ? "127.0.0.1" : existing.host}:${existing.port}`,
      );
      return;
    }
  }

  if (tmuxListWindows(opts.session).includes(UI_WINDOW_NAME)) {
    console.log(`   UI window "${UI_WINDOW_NAME}" already present in session "${opts.session}".`);
    return;
  }

  const flags = [
    "--foreground",
    "--tmux-session",
    opts.session,
    "--team",
    opts.team,
  ];
  if (opts.port !== undefined) flags.push("--port", String(opts.port));
  if (opts.host !== undefined) flags.push("--host", opts.host);
  const binName = which("parachute-octopus") ? "parachute-octopus" : which("octopus") ? "octopus" : null;
  const uiCmd = binName
    ? [binName, "ui", ...flags].map(quote).join(" ")
    : [process.execPath, process.argv[1], "ui", ...flags].map(quote).join(" ");

  const code = tmuxNewWindow(opts.session, UI_WINDOW_NAME, opts.cwd, uiCmd);
  if (code !== 0) {
    console.error(
      `warning: failed to start UI window (tmux exited ${code}). You can start it manually with \`parachute-octopus ui\`.`,
    );
    return;
  }
  const port = opts.port ?? Number(process.env.OCTOPUS_UI_PORT ?? 6061);
  const host = opts.host ?? process.env.OCTOPUS_UI_HOST ?? "0.0.0.0";
  const display = host === "0.0.0.0" || host === "::" ? "127.0.0.1" : host;
  console.log(
    `   UI window "${UI_WINDOW_NAME}" started in session "${opts.session}" → http://${display}:${port}`,
  );
}

function quote(s: string): string {
  if (/^[a-zA-Z0-9_./@:=+-]+$/.test(s)) return s;
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
