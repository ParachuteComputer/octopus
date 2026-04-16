// Thin process helpers for the CLI. Kept separate from src/ui/tmux.ts so the
// CLI doesn't need to import the streaming/snapshot machinery just to shell
// out to tmux send-keys.

export function which(cmd: string): boolean {
  const r = Bun.spawnSync(["which", cmd], { stdout: "ignore", stderr: "ignore" });
  return r.exitCode === 0;
}

export function tmuxHasSession(name: string): boolean {
  const r = Bun.spawnSync(["tmux", "has-session", "-t", name], {
    stdout: "ignore",
    stderr: "ignore",
  });
  return r.exitCode === 0;
}

/**
 * Returns the list of window names in a session, or [] if the session
 * doesn't exist or tmux fails. Used to make `octopus launch`'s UI-window
 * setup idempotent.
 */
export function tmuxListWindows(session: string): string[] {
  const r = Bun.spawnSync(
    ["tmux", "list-windows", "-t", session, "-F", "#{window_name}"],
    { stdout: "pipe", stderr: "ignore" },
  );
  if (r.exitCode !== 0) return [];
  const out = new TextDecoder().decode(r.stdout);
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Creates a new detached window in the given session running `command`.
 * Returns the exit code of `tmux new-window`.
 */
export function tmuxNewWindow(
  session: string,
  windowName: string,
  cwd: string,
  command: string,
): number {
  const r = Bun.spawnSync(
    [
      "tmux",
      "new-window",
      "-d",
      "-t",
      session,
      "-n",
      windowName,
      "-c",
      cwd,
      command,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  return r.exitCode ?? 1;
}

export function tmuxSendKeys(target: string, text: string, withEnter = true): number {
  const args = ["tmux", "send-keys", "-t", target, "--", text];
  const r = Bun.spawnSync(args, { stdout: "inherit", stderr: "inherit" });
  if (r.exitCode !== 0) return r.exitCode ?? 1;
  if (withEnter) {
    const e = Bun.spawnSync(["tmux", "send-keys", "-t", target, "Enter"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    return e.exitCode ?? 0;
  }
  return 0;
}
