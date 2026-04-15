// Tiny flag parser — just enough for the handful of long flags we accept.
// Anything unrecognized is left in the positional list so subcommands can
// pass-through arbitrary tail args (e.g. `octopus send /reload-plugins`).

export interface ParsedFlags {
  flags: Record<string, string | true>;
  positional: string[];
}

export function parseFlags(args: string[], known: string[]): ParsedFlags {
  const flags: Record<string, string | true> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const name = a.slice(2);
      if (!known.includes(name)) {
        positional.push(a);
        continue;
      }
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[name] = next;
        i++;
      } else {
        flags[name] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}
