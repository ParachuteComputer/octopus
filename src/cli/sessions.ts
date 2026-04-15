import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { parseFlags } from "./flags.ts";

export interface SessionInfo {
  id: string;
  path: string;
  firstTimestamp?: string;
  lastTimestamp?: string;
  durationMs?: number;
  sizeBytes: number;
}

// Claude Code encodes a project cwd into a directory name by replacing each
// "/" with "-". So `/Users/alice/code/foo` becomes `-Users-alice-code-foo`.
export function encodeProjectCwd(cwd: string): string {
  return cwd.replace(/\//g, "-");
}

export function projectsRoot(): string {
  return join(homedir(), ".claude", "projects");
}

// Scan a chunk of text for the first occurrence of a `"timestamp":"..."` value
// and return the value (or undefined). Stops at the first match — we don't
// need to parse the whole line.
function firstTimestamp(text: string): string | undefined {
  const m = text.match(/"timestamp":"([^"]+)"/);
  return m?.[1];
}

function lastTimestamp(text: string): string | undefined {
  const m = [...text.matchAll(/"timestamp":"([^"]+)"/g)];
  return m.length ? m[m.length - 1]?.[1] : undefined;
}

// Read the first and last chunks of a file without loading the whole thing.
// We scan at most HEAD_BYTES from the start and TAIL_BYTES from the end for
// timestamp fields. Sessions with millions of entries stay cheap.
const HEAD_BYTES = 32 * 1024;
const TAIL_BYTES = 32 * 1024;

export async function readSessionMeta(path: string): Promise<SessionInfo> {
  const file = Bun.file(path);
  const size = file.size;
  const headEnd = Math.min(size, HEAD_BYTES);
  const tailStart = Math.max(0, size - TAIL_BYTES);

  const head = await file.slice(0, headEnd).text();
  // If the file is small enough that the head already covers everything,
  // don't read a second time — saves a syscall on short sessions.
  const tail = tailStart < headEnd ? head : await file.slice(tailStart, size).text();

  const first = firstTimestamp(head);
  const last = lastTimestamp(tail);
  const durationMs =
    first && last ? new Date(last).getTime() - new Date(first).getTime() : undefined;

  const id = path.split("/").pop()?.replace(/\.jsonl$/, "") ?? path;
  return { id, path, firstTimestamp: first, lastTimestamp: last, durationMs, sizeBytes: size };
}

export async function listSessions(cwd: string, root = projectsRoot()): Promise<SessionInfo[]> {
  const dir = join(root, encodeProjectCwd(cwd));
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const jsonls = entries.filter((e) => e.endsWith(".jsonl"));
  const metas = await Promise.all(jsonls.map((f) => readSessionMeta(join(dir, f))));
  // Sort by last-activity desc; sessions with no timestamp go last.
  return metas.sort((a, b) => {
    const ta = a.lastTimestamp ? new Date(a.lastTimestamp).getTime() : 0;
    const tb = b.lastTimestamp ? new Date(b.lastTimestamp).getTime() : 0;
    return tb - ta;
  });
}

// Format a duration in ms as "2 hours", "45 min", "12 sec", etc. — imprecise
// by design, so the output scans easily.
export function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} sec of context`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min of context`;
  const hr = ms / (1000 * 60 * 60);
  if (hr < 10) return `${hr.toFixed(1)} hours of context`;
  return `${Math.round(hr)} hours of context`;
}

// Format a timestamp like "2026-04-15 17:43" in local time.
export function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatSessionsList(sessions: SessionInfo[]): string {
  if (sessions.length === 0) {
    return "No Claude Code sessions found for this project.\n\nStart a fresh one with: octopus launch";
  }
  const lines = ["Recent Claude Code sessions in this project:", ""];
  sessions.slice(0, 10).forEach((s, i) => {
    const when = s.lastTimestamp ? formatTimestamp(s.lastTimestamp) : "unknown time";
    const dur = s.durationMs !== undefined ? formatDuration(s.durationMs) : "duration unknown";
    lines.push(`  ${i + 1}. ${when}  ${dur} · ${s.id}`);
  });
  lines.push("");
  lines.push("Resume the most recent with: octopus launch --continue");
  lines.push("Resume a specific one with:  octopus launch --resume <session-id>");
  return lines.join("\n");
}

export async function runSessions(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["cwd"]);
  const cwd = resolve((flags.cwd as string) ?? process.cwd());
  const sessions = await listSessions(cwd);
  console.log(formatSessionsList(sessions));
}
