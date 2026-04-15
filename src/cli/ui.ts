import { parseFlags } from "./flags.ts";

export async function runUi(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["team", "team-config", "port", "host", "poll-ms"]);

  // Push CLI flags into env so the embedded server picks them up — keeps the
  // server module env-driven (it doesn't need to know the CLI exists).
  if (flags["team"]) process.env.OCTOPUS_TEAM = String(flags["team"]);
  if (flags["team-config"]) process.env.OCTOPUS_TEAM_CONFIG = String(flags["team-config"]);
  if (flags["port"]) process.env.OCTOPUS_UI_PORT = String(flags["port"]);
  if (flags["host"]) process.env.OCTOPUS_UI_HOST = String(flags["host"]);
  if (flags["poll-ms"]) process.env.OCTOPUS_UI_POLL_MS = String(flags["poll-ms"]);

  const { app } = await import("../ui/server.tsx");
  const port = Number(process.env.OCTOPUS_UI_PORT ?? 6061);
  const host = process.env.OCTOPUS_UI_HOST ?? "127.0.0.1";
  console.log(`🐙 octopus → http://${host}:${port}`);
  Bun.serve({ fetch: app.fetch, port, hostname: host, idleTimeout: 0 });
}
