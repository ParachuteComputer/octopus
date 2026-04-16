import { spawn } from "bun";

async function run(args: string[]): Promise<string> {
  const proc = spawn(["tmux", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exit] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exit !== 0) {
    throw new Error(`tmux ${args.join(" ")} failed (${exit}): ${stderr.trim()}`);
  }
  return stdout;
}

export interface LivePane {
  paneId: string;
  session: string;
  window: number;
  index: number;
  width: number;
  height: number;
}

export async function listPanes(sessionFilter?: string): Promise<LivePane[]> {
  const args = sessionFilter
    ? ["list-panes", "-t", sessionFilter, "-F", "#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_id}\t#{pane_width}\t#{pane_height}"]
    : ["list-panes", "-a", "-F", "#{session_name}\t#{window_index}\t#{pane_index}\t#{pane_id}\t#{pane_width}\t#{pane_height}"];
  let out: string;
  try {
    out = await run(args);
  } catch {
    return [];
  }
  return out
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [session, window, index, paneId, width, height] = line.split("\t");
      return {
        session,
        window: Number(window),
        index: Number(index),
        paneId,
        width: Number(width),
        height: Number(height),
      };
    });
}

export async function capturePane(paneId: string, lines: number): Promise<string> {
  try {
    return await run(["capture-pane", "-t", paneId, "-p", "-S", `-${lines}`]);
  } catch {
    return "";
  }
}

export async function sendKeys(paneId: string, text: string, withEnter = true): Promise<void> {
  const args = ["send-keys", "-t", paneId, "--", text];
  await run(args);
  if (withEnter) {
    await run(["send-keys", "-t", paneId, "Enter"]);
  }
}

// Send a raw tmux key name (Escape, C-c, Up, …) — no "--" separator since these
// must be parsed as key names, not literal text. No trailing Enter.
const ALLOWED_KEYS = new Set([
  "Escape",
  "Enter",
  "Tab",
  "BTab",
  "BSpace",
  "Up",
  "Down",
  "Left",
  "Right",
  "C-c",
  "C-d",
  "C-z",
  "C-l",
  "PageUp",
  "PageDown",
  "Home",
  "End",
]);

export function isValidKey(key: string): boolean {
  return ALLOWED_KEYS.has(key);
}

export async function sendKey(paneId: string, key: string): Promise<void> {
  if (!isValidKey(key)) {
    throw new Error(`unsupported key: ${key}`);
  }
  await run(["send-keys", "-t", paneId, key]);
}

export const TMUX_NAME_REGEX = /──\s+@([a-zA-Z0-9_-]+)\s+──/;

export function extractTentacleName(paneContent: string): string | null {
  const m = paneContent.match(TMUX_NAME_REGEX);
  return m ? m[1] : null;
}

// Multiple signals identify the primary (team-lead) Claude Code session. It
// doesn't paint a `── @name ──` banner — it renders a teammates strip and a
// teammate count instead. Match on whichever one is present so we don't lose
// the team-lead row during a slash-command dispatch (when the strip briefly
// rerenders without all teammates). Any single match is sufficient.
const PRIMARY_SIGNALS: RegExp[] = [
  /@main\s+@[a-zA-Z0-9_-]+/,         // strip with one or more teammates
  /@main\s*→/,                        // strip with no teammates listed yet
  /·\s+\d+\s+teammates?\b/,           // numeric "· N teammates" badge
  /^\s*@main\b/m,                     // bare @main on its own line
];

export function isPrimarySessionPane(paneContent: string): boolean {
  return PRIMARY_SIGNALS.some((rx) => rx.test(paneContent));
}

// Broader check: does this pane look like a Claude Code session at all?
// Used as a fallback when the primary session isn't running in team mode
// (no @main strip) but we still want to detect the team-lead.
const CLAUDE_CODE_SIGNALS: RegExp[] = [
  /^\s*❯\s*/m,                          // Claude Code prompt
  /Running…|Cogitated|Sautéed|Pondering|Thinking|Simmering|Marinating/,
  /bypass permissions on/,
  /Remote Control active/,
  /⏵⏵/,                                 // fast-mode indicator
];

export function isClaudeCodePane(paneContent: string): boolean {
  return CLAUDE_CODE_SIGNALS.some((rx) => rx.test(paneContent));
}
