import { parseFlags } from "./flags.ts";
import { tmuxHasSession, tmuxSendKeys, which } from "./tmux.ts";

export async function runSend(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv, ["session", "team"]);
  if (positional.length === 0) {
    console.error("error: send requires at least one argument");
    console.error("usage: octopus send <text...> [--session <name>]");
    process.exit(1);
  }
  if (!which("tmux")) {
    console.error("error: tmux is not installed or not on PATH.");
    process.exit(1);
  }
  const session =
    (flags.session as string) ??
    (flags.team as string) ??
    process.env.OCTOPUS_TEAM ??
    "octopus";

  if (!tmuxHasSession(session)) {
    console.error(`error: no running tmux session "${session}".`);
    console.error("Run `parachute-octopus launch` first.");
    process.exit(1);
  }

  const text = positional.join(" ");
  const code = tmuxSendKeys(session, text, true);
  if (code !== 0) {
    console.error(`error: tmux send-keys failed (exit ${code}).`);
    process.exit(code);
  }
  console.log(`sent to ${session}: ${text}`);
}
