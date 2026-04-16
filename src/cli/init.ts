import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseFlags } from "./flags.ts";
import { resolveTemplatesDir } from "../paths.ts";

const TEMPLATE_FILES: { src: string; dest: string }[] = [
  { src: "spawn.md",    dest: ".claude/commands/spawn.md" },
  { src: "report.md",   dest: ".claude/commands/report.md" },
  { src: "tentacle.md", dest: ".claude/agents/tentacle.md" },
  { src: "reviewer.md", dest: ".claude/agents/reviewer.md" },
  { src: "octopus.md",  dest: ".claude/octopus.md" },
];

const CLAUDE_MD_LINK = "@.claude/octopus.md";

export async function runInit(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv, ["team", "cwd"]);
  const team = (flags.team as string) ?? "octopus";
  const targetCwd = resolve((flags.cwd as string) ?? process.cwd());
  const templatesDir = resolveTemplatesDir();

  if (!existsSync(templatesDir)) {
    throw new Error(`templates directory not found at ${templatesDir} — package install may be incomplete`);
  }

  console.log(`parachute-octopus init — team "${team}" in ${targetCwd}`);
  for (const { src, dest } of TEMPLATE_FILES) {
    const srcPath = join(templatesDir, src);
    const destPath = join(targetCwd, dest);
    mkdirSync(join(destPath, ".."), { recursive: true });
    writeFileSync(destPath, readFileSync(srcPath, "utf8"));
    console.log(`  wrote ${dest}`);
  }

  ensureClaudeMdLink(targetCwd);
  console.log(`done. next: \`octopus launch\` to start the team-lead session.`);
}

function ensureClaudeMdLink(targetCwd: string): void {
  const path = join(targetCwd, "CLAUDE.md");
  if (!existsSync(path)) {
    const body =
      `${CLAUDE_MD_LINK}\n\n` +
      `<!-- Octopus team conventions are loaded above. Add project-specific\n` +
      `     guidance for tentacles and the team-lead below. -->\n`;
    writeFileSync(path, body);
    console.log(`  created CLAUDE.md with octopus link`);
    return;
  }
  const existing = readFileSync(path, "utf8");
  if (existing.includes(CLAUDE_MD_LINK)) {
    console.log(`  CLAUDE.md already links octopus conventions — left untouched`);
    return;
  }
  // Prepend the link as the first line so Claude Code auto-loads the snippet.
  writeFileSync(path, `${CLAUDE_MD_LINK}\n\n${existing}`);
  console.log(`  prepended ${CLAUDE_MD_LINK} to CLAUDE.md`);
}
