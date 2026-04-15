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
