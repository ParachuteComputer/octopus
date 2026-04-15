import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Path helpers shared between the CLI and the embedded UI server.

/**
 * Resolve the team config path using the priority chain:
 *   1. explicit override (CLI flag / OCTOPUS_TEAM_CONFIG)
 *   2. project-local: <cwd>/.claude/teams/<team>/config.json
 *   3. home-dir:      ~/.claude/teams/<team>/config.json
 *
 * Returns the first path that exists, or the home-dir path as the last-resort
 * default. Callers that need to fail loudly should call requireTeamConfig().
 */
export function resolveTeamConfigPath(team: string, override?: string): string {
  if (override && override.trim()) return resolve(override);
  const projectLocal = join(process.cwd(), ".claude", "teams", team, "config.json");
  if (existsSync(projectLocal)) return projectLocal;
  return join(homedir(), ".claude", "teams", team, "config.json");
}

export function requireTeamConfig(team: string, override?: string): string {
  const path = resolveTeamConfigPath(team, override);
  if (!existsSync(path)) {
    throw new Error(
      `No octopus team config found for team "${team}". Looked at:\n` +
        `  • ${join(process.cwd(), ".claude", "teams", team, "config.json")}\n` +
        `  • ${join(homedir(), ".claude", "teams", team, "config.json")}\n` +
        `Run \`octopus init\` in this repo, then \`octopus launch\`.`,
    );
  }
  return path;
}

/**
 * Locate the `public/` directory that ships with the package. We walk up from
 * this file's directory looking for a sibling `public/` — works for both the
 * source tree (src/paths.ts → ../public) and the built dist tree
 * (dist/paths.js → ../public).
 */
export function resolvePublicDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "public"),
    join(here, "..", "..", "public"),
    join(here, "public"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "styles.css"))) return resolve(c);
  }
  // Fall back to cwd/public so tests run from the source tree still find it.
  return resolve(join(process.cwd(), "public"));
}

export function resolveTemplatesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "templates"),
    join(here, "..", "..", "templates"),
    join(here, "templates"),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, "spawn.md"))) return resolve(c);
  }
  return resolve(join(process.cwd(), "templates"));
}

/**
 * Spawn-target roots feed the spawn modal's cwd datalist suggestions. Override
 * with OCTOPUS_SPAWN_TARGETS (colon-separated absolute paths). Defaults to the
 * current working directory and its parent — sensible "siblings of this repo".
 */
export function resolveSpawnTargetRoots(): string[] {
  const env = process.env.OCTOPUS_SPAWN_TARGETS;
  if (env && env.trim()) {
    return env
      .split(":")
      .map((p) => p.trim())
      .filter((p) => p.startsWith("/"))
      .map((p) => resolve(p));
  }
  const cwd = process.cwd();
  return [cwd, resolve(cwd, "..")];
}
