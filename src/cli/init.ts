import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { resolveTemplatesDir } from "../paths.ts";

const TEMPLATE_FILES: { src: string; dest: string }[] = [
  { src: "spawn.md",    dest: ".claude/commands/spawn.md" },
  { src: "report.md",   dest: ".claude/commands/report.md" },
  { src: "tentacle.md", dest: ".claude/agents/tentacle.md" },
  { src: "reviewer.md", dest: ".claude/agents/reviewer.md" },
];

const FENCE_START = "<!-- octopus:start -->";
const FENCE_END = "<!-- octopus:end -->";

export async function runInit(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["team", "cwd"]);
  const team = (flags.team as string) ?? "octopus";
  const targetCwd = resolve((flags.cwd as string) ?? process.cwd());
  const templatesDir = resolveTemplatesDir();

  if (!existsSync(templatesDir)) {
    throw new Error(`templates directory not found at ${templatesDir} — package install may be incomplete`);
  }

  console.log(`parachute-octopus init — team "${team}" in ${targetCwd}`);

  // Write agent definitions and slash commands — these are the mechanical
  // contract that Claude Code reads directly. init owns them.
  for (const { src, dest } of TEMPLATE_FILES) {
    const srcPath = join(templatesDir, src);
    const destPath = join(targetCwd, dest);
    mkdirSync(join(destPath, ".."), { recursive: true });
    writeFileSync(destPath, readFileSync(srcPath, "utf8"));
    console.log(`  wrote ${dest}`);
  }

  // Clean up legacy .claude/octopus.md if present (replaced by inline content)
  const legacyPath = join(targetCwd, ".claude", "octopus.md");
  if (existsSync(legacyPath)) {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(legacyPath);
    console.log(`  removed .claude/octopus.md (now inlined in CLAUDE.md)`);
  }

  await ensureClaudeMd(targetCwd, templatesDir);
  console.log(`done. next: \`parachute-octopus launch\` to start the team-lead session.`);
}

function loadOctopusSection(templatesDir: string): string {
  const raw = readFileSync(join(templatesDir, "octopus.md"), "utf8");
  return `${FENCE_START}\n${raw.trimEnd()}\n${FENCE_END}`;
}

async function ensureClaudeMd(targetCwd: string, templatesDir: string): Promise<void> {
  const path = join(targetCwd, "CLAUDE.md");
  const section = loadOctopusSection(templatesDir);

  // No CLAUDE.md — create with just the octopus section
  if (!existsSync(path)) {
    writeFileSync(path, section + "\n");
    console.log(`  created CLAUDE.md with octopus conventions`);
    return;
  }

  const existing = readFileSync(path, "utf8");

  // Already has fenced section — update it in place
  if (existing.includes(FENCE_START) && existing.includes(FENCE_END)) {
    const before = existing.slice(0, existing.indexOf(FENCE_START));
    const after = existing.slice(existing.indexOf(FENCE_END) + FENCE_END.length);
    writeFileSync(path, before + section + after);
    console.log(`  updated octopus section in CLAUDE.md`);
    return;
  }

  // Has legacy @.claude/octopus.md link — replace it with inline content
  if (existing.includes("@.claude/octopus.md")) {
    const cleaned = existing
      .replace(/^@\.claude\/octopus\.md\n*/m, "")
      .replace(/<!-- Octopus team conventions.*?-->\n*/s, "");
    const body = cleaned.trim() ? section + "\n\n" + cleaned.trim() + "\n" : section + "\n";
    writeFileSync(path, body);
    console.log(`  migrated CLAUDE.md from @link to inline octopus section`);
    return;
  }

  // Existing CLAUDE.md with content but no octopus section — ask
  if (existing.trim()) {
    console.log(`\n  CLAUDE.md already exists with content.`);
    console.log(`  Octopus conventions can be added to help the team-lead session.`);
    console.log(`\n  Options:`);
    console.log(`    p  — prepend octopus section to the top`);
    console.log(`    a  — append octopus section to the bottom`);
    console.log(`    s  — show what would be added`);
    console.log(`    n  — skip, leave CLAUDE.md untouched`);

    const answer = await prompt("\n  choice [p/a/s/n]: ");
    const choice = answer?.trim().toLowerCase();

    if (choice === "s") {
      console.log(`\n--- octopus section ---`);
      console.log(section);
      console.log(`--- end ---\n`);
      const followUp = await prompt("  add to CLAUDE.md? [p/a/n]: ");
      return applyChoice(followUp?.trim().toLowerCase() ?? "n", path, existing, section);
    }

    return applyChoice(choice ?? "n", path, existing, section);
  }

  // Empty CLAUDE.md — write directly
  writeFileSync(path, section + "\n");
  console.log(`  wrote octopus conventions to CLAUDE.md`);
}

function applyChoice(choice: string, path: string, existing: string, section: string): void {
  if (choice === "p") {
    writeFileSync(path, section + "\n\n" + existing);
    console.log(`  prepended octopus section to CLAUDE.md`);
  } else if (choice === "a") {
    const separator = existing.endsWith("\n") ? "\n" : "\n\n";
    writeFileSync(path, existing + separator + section + "\n");
    console.log(`  appended octopus section to CLAUDE.md`);
  } else {
    console.log(`  skipped CLAUDE.md`);
  }
}

async function prompt(msg: string): Promise<string | null> {
  process.stdout.write(msg);
  const reader = Bun.stdin.stream().getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  return value ? new TextDecoder().decode(value).trim() : null;
}
