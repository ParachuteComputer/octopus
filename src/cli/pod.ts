import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { addInstance, loadPod, podPath, podStatus, removeInstance } from "../pod.ts";

export async function runPod(argv: string[]): Promise<void> {
  const sub = argv[0];
  if (sub === "add") return podAdd(argv.slice(1));
  if (sub === "remove" || sub === "rm") return podRemove(argv.slice(1));
  return podList();
}

function podList(): void {
  const statuses = podStatus();
  if (statuses.length === 0) {
    console.log("no octopi registered yet.");
    console.log(`\n  octopus pod add <name> --scope <dir>    register one`);
    console.log(`  octopus pod add <name>                  register using cwd as scope`);
    return;
  }

  const nameW = Math.max(4, ...statuses.map((s) => s.name.length));
  const statusW = 7;
  const header = `${"NAME".padEnd(nameW)}  ${"STATUS".padEnd(statusW)}  SCOPE`;
  console.log(header);
  for (const s of statuses) {
    const status = s.running ? "running" : "stopped";
    const desc = s.description ? ` — ${s.description}` : "";
    console.log(`${s.name.padEnd(nameW)}  ${status.padEnd(statusW)}  ${s.scope}${desc}`);
  }
  console.log(`\n${statuses.length} octop${statuses.length === 1 ? "us" : "i"} in ${podPath()}`);
}

function podAdd(argv: string[]): void {
  const { flags, positional } = parseFlags(argv, ["scope", "description"]);
  const name = positional[0];
  if (!name) {
    console.error("usage: octopus pod add <name> [--scope <dir>] [--description <text>]");
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]{0,30}$/.test(name)) {
    console.error("error: name must be lowercase letters/digits/dashes, start with letter, max 31 chars");
    process.exit(1);
  }
  const scope = resolve((flags.scope as string) ?? process.cwd());
  if (!existsSync(scope)) {
    console.error(`error: scope directory does not exist: ${scope}`);
    process.exit(1);
  }
  const description = (flags.description as string) || undefined;

  const existing = loadPod().octopi.find((o) => o.name === name);
  addInstance({ name, scope, description });

  if (existing) {
    console.log(`updated octopus "${name}" → ${scope}`);
  } else {
    console.log(`registered octopus "${name}" → ${scope}`);
  }
  console.log(`\nnext: octopus init    (in ${scope}, to bootstrap .claude/ files)`);
  console.log(`then: octopus launch ${name}`);
}

function podRemove(argv: string[]): void {
  const name = argv[0];
  if (!name) {
    console.error("usage: octopus pod remove <name>");
    process.exit(1);
  }
  if (removeInstance(name)) {
    console.log(`removed "${name}" from pod (files in scope dir left untouched)`);
  } else {
    console.error(`error: no octopus named "${name}" in pod`);
    process.exit(1);
  }
}
