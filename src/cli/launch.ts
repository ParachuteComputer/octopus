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

const UI_WINDOW_NAME = "octopus-ui";

export async function runLaunch(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, [
    "team",
    "cwd",
    "session",
    "model",
    "no-skip-permissions",
    "no-ui",
    "ui-port",
    "ui-host",
  ]);
  const team = (flags.team as string) ?? process.env.OCTOPUS_TEAM ?? "octopus";
  const cwd = resolve((flags.cwd as string) ?? process.cwd());
  const session = (flags.session as string) ?? team;
  const model = (flags.model as string) ?? "";
  // Default: pass --dangerously-skip-permissions so the team-lead can dispatch
  // freely. Opt out via --no-skip-permissions or OCTOPUS_SKIP_PERMISSIONS=false
  // for shared / less-trusted environments.
  const skipPermissions =
    !flags["no-skip-permissions"] &&
    process.env.OCTOPUS_SKIP_PERMISSIONS !== "false";

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
      "-e",
      `OCTOPUS_TEAM=${team}`,
      "claude",
    ];
    if (skipPermissions) claudeArgs.push("--dangerously-skip-permissions");
    if (model) claudeArgs.push("--model", model);
    const create = Bun.spawnSync(claudeArgs, { stdout: "inherit", stderr: "inherit" });
    if (create.exitCode !== 0) {
      console.error("error: failed to create tmux session.");
      process.exit(create.exitCode ?? 1);
    }
    console.log(`started octopus team "${team}" in tmux session "${session}" (cwd: ${cwd})`);
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
  // 1. If a UI is already running (anywhere — tmux, daemon, foreign), don't
  //    spawn a second one. Point at the live one and move on.
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

  // 2. If our session already has the UI window, leave it alone (idempotent
  //    re-launch).
  if (tmuxListWindows(opts.session).includes(UI_WINDOW_NAME)) {
    console.log(`   UI window "${UI_WINDOW_NAME}" already present in session "${opts.session}".`);
    return;
  }

  // 3. Build the command. Prefer the `octopus` bin if it's on PATH so the
  //    window survives a `bun upgrade` of the dev tree; fall back to invoking
  //    this same script via bun for source-tree development.
  const flags = [
    "--foreground",
    "--tmux-session",
    opts.session,
    "--team",
    opts.team,
  ];
  if (opts.port !== undefined) flags.push("--port", String(opts.port));
  if (opts.host !== undefined) flags.push("--host", opts.host);
  const uiCmd = which("octopus")
    ? ["octopus", "ui", ...flags].map(quote).join(" ")
    : [process.execPath, process.argv[1], "ui", ...flags].map(quote).join(" ");

  const code = tmuxNewWindow(opts.session, UI_WINDOW_NAME, opts.cwd, uiCmd);
  if (code !== 0) {
    console.error(
      `warning: failed to start UI window (tmux exited ${code}). You can start it manually with \`octopus ui\`.`,
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
  // Shell-quote for the tmux command string. tmux runs the command via
  // /bin/sh -c, so single-quote anything containing whitespace or shell metas.
  // Note: `-` placed at end of class to avoid being misread as a range.
  if (/^[a-zA-Z0-9_./@:=+-]+$/.test(s)) return s; // eslint-disable-line no-useless-escape
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
