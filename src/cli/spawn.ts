import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { tmuxHasSession, tmuxSendKeys, which } from "./tmux.ts";

const NAME_RX = /^[a-z][a-z0-9-]{1,30}$/;

export async function runSpawn(argv: string[]): Promise<void> {
  const { flags, positional } = parseFlags(argv, ["session", "team"]);
  const [name, cwdRaw, ...promptParts] = positional;

  if (!name || !cwdRaw) {
    console.error("error: spawn requires <name> <cwd> [prompt...]");
    console.error("usage: octopus spawn <name> <cwd> <prompt...>");
    process.exit(1);
  }
  if (!NAME_RX.test(name)) {
    console.error(`error: invalid name "${name}" (lowercase letters/digits/dashes, 2-31 chars, must start with letter)`);
    process.exit(1);
  }
  const cwd = resolve(cwdRaw);
  if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
    console.error(`error: cwd does not exist or is not a directory: ${cwd}`);
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

  // Slash-command $ARGUMENTS is single-line; flatten any whitespace so the tty
  // doesn't submit early. Long briefs should be sent as a follow-up message.
  const prompt = promptParts.join(" ").replace(/\s+/g, " ").trim();
  const command = `/spawn ${name} ${cwd}${prompt ? ` ${prompt}` : ""}`;
  const code = tmuxSendKeys(session, command, true);
  if (code !== 0) {
    console.error(`error: tmux send-keys failed (exit ${code}).`);
    process.exit(code);
  }
  console.log(`typed to ${session}: /spawn ${name} …`);
}
