import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { tmuxHasSession } from "./cli/tmux.ts";

export interface OctopusInstance {
  name: string;
  scope: string;
  description?: string;
}

export interface Pod {
  octopi: OctopusInstance[];
}

export function podPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config");
  return join(xdg, "octopus", "pod.json");
}

export function loadPod(): Pod {
  const p = podPath();
  if (!existsSync(p)) return { octopi: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Pod;
  } catch {
    return { octopi: [] };
  }
}

export function savePod(pod: Pod): void {
  const p = podPath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(pod, null, 2) + "\n");
}

export function findInstance(name: string): OctopusInstance | undefined {
  return loadPod().octopi.find((o) => o.name === name);
}

/**
 * Reverse lookup: find a pod instance whose scope matches the given directory.
 * Matches exact path (after normalization). Returns undefined if no match.
 */
export function findInstanceByScope(dir: string): OctopusInstance | undefined {
  const normalized = resolve(dir);
  return loadPod().octopi.find((o) => resolve(o.scope) === normalized);
}

export function addInstance(instance: OctopusInstance): void {
  const pod = loadPod();
  const existing = pod.octopi.findIndex((o) => o.name === instance.name);
  if (existing >= 0) {
    pod.octopi[existing] = instance;
  } else {
    pod.octopi.push(instance);
  }
  savePod(pod);
}

export function removeInstance(name: string): boolean {
  const pod = loadPod();
  const before = pod.octopi.length;
  pod.octopi = pod.octopi.filter((o) => o.name !== name);
  if (pod.octopi.length === before) return false;
  savePod(pod);
  return true;
}

export interface PodStatus {
  name: string;
  scope: string;
  description?: string;
  running: boolean;
  session: string;
}

export function podStatus(): PodStatus[] {
  const pod = loadPod();
  return pod.octopi.map((o) => {
    const session = o.name;
    return {
      name: o.name,
      scope: o.scope,
      description: o.description,
      running: tmuxHasSession(session),
      session,
    };
  });
}
