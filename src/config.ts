// Re-exports for the team-config layer. The actual loader lives in src/ui/state.ts
// (where it's used by the snapshot pipeline). This module gives the CLI a
// stable import surface that doesn't reach into the UI internals.
export {
  getConfigPath,
  loadConfig,
  setConfigPath,
  type ConfigMember,
  type TeamConfig,
} from "./ui/state.ts";
export {
  requireTeamConfig,
  resolveTeamConfigPath,
} from "./paths.ts";
