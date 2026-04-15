import { describe, expect, test } from "bun:test";
import { deriveStatus, shortCwd } from "../src/ui/state.ts";
import { extractTentacleName } from "../src/ui/tmux.ts";

describe("deriveStatus", () => {
  test("working when recent output contains a 'Cogitated' banner", () => {
    expect(deriveStatus(["⏺ did a thing", "✻ Cogitated for 1m 2s", "❯ "])).toBe("working");
  });

  test("idle when the last non-empty line is the bare prompt", () => {
    expect(deriveStatus(["⏺ handed back", "", "❯ ", "──────────────"])).toBe("idle");
  });
});

describe("extractTentacleName", () => {
  test("pulls the name out of a status-bar banner", () => {
    expect(extractTentacleName("before\n──── @daily-oauth ──\nafter")).toBe("daily-oauth");
  });

  test("returns null when no banner present", () => {
    expect(extractTentacleName("plain output\n$ ls")).toBeNull();
  });
});

describe("shortCwd", () => {
  test("keeps the last two segments", () => {
    expect(shortCwd("/Users/x/UnforcedAGI/Code/ParachuteComputer/parachute-vault")).toBe(
      "ParachuteComputer/parachute-vault",
    );
  });
  test("empty input → empty output", () => {
    expect(shortCwd("")).toBe("");
  });
});
