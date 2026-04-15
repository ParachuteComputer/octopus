#!/usr/bin/env bun
// octopus — team layer for Claude Code.
// Subcommands dispatch to ./cli/*.ts. Flags are parsed locally in each
// subcommand to keep the surface tiny and avoid a flag-parser dependency.

import { runHelp } from "./cli/help.ts";
import { runInit } from "./cli/init.ts";
import { runLaunch } from "./cli/launch.ts";
import { runSend } from "./cli/send.ts";
import { runSessions } from "./cli/sessions.ts";
import { runSpawn } from "./cli/spawn.ts";
import { runUi } from "./cli/ui.ts";

const VERSION = "0.1.0";

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    runHelp();
    return;
  }
  if (command === "version" || command === "--version" || command === "-v") {
    console.log(VERSION);
    return;
  }

  switch (command) {
    case "init":
      await runInit(rest);
      return;
    case "launch":
      await runLaunch(rest);
      return;
    case "ui":
      await runUi(rest);
      return;
    case "send":
      await runSend(rest);
      return;
    case "spawn":
      await runSpawn(rest);
      return;
    case "sessions":
      await runSessions(rest);
      return;
    default:
      console.error(`unknown command: ${command}`);
      console.error(`run \`octopus help\` for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
