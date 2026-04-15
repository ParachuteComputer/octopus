// Per-tentacle colors, tuned to sit harmonious against Parachute's forest-dark bg.
// Each hue desaturated ~15-20% from the original so they feel earthy rather than
// neon. Green is literally nightForest; orange matches the stale-amber.
export const TENTACLE_COLORS: Record<string, string> = {
  blue: "#8AA6BF",    // dusty steel
  yellow: "#D4BC7E",  // soft warm gold
  purple: "#B09AC7",  // dusty lilac
  orange: "#D4A373",  // warm amber (matches --amber)
  cyan: "#8CCFCE",    // nightTurquoise
  green: "#7AB09D",   // nightForest
  pink: "#C9A0AA",    // dusty rose
  red: "#C88A7D",     // muted terracotta
  teal: "#6FA5A0",    // softer teal
  slate: "#9B9590",   // driftwood
};

export function colorFor(name: string | undefined): string {
  if (!name) return TENTACLE_COLORS.slate;
  return TENTACLE_COLORS[name] ?? TENTACLE_COLORS.slate;
}
