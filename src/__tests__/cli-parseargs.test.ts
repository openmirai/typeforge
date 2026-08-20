import { describe, expect, it } from "vitest";

import { parseArgs } from "../cli";

describe("parseArgs - multi-source", () => {
  it("collects multiple --source flags into sources array", () => {
    const result = parseArgs([
      "generate",
      "--source",
      "core-v2",
      "--source",
      "central-v2",
    ]);
    expect(result.sources).toEqual(["core-v2", "central-v2"]);
    expect(result.source).toBe("core-v2");
    expect(result.command).toBe("generate");
  });

  it("collects multiple --source= forms into sources array", () => {
    const result = parseArgs([
      "generate",
      "--source=core-v2",
      "--source=central-v2",
    ]);
    expect(result.sources).toEqual(["core-v2", "central-v2"]);
  });

  it("mixes --source and --source= forms", () => {
    const result = parseArgs([
      "generate",
      "--source",
      "alpha",
      "--source=beta",
      "--source",
      "gamma",
    ]);
    expect(result.sources).toEqual(["alpha", "beta", "gamma"]);
    expect(result.source).toBe("alpha");
  });

  it("single --source populates both source and sources", () => {
    const result = parseArgs(["generate", "--source", "atlas"]);
    expect(result.sources).toEqual(["atlas"]);
    expect(result.source).toBe("atlas");
  });

  it("--all sets all flag without requiring --source", () => {
    const result = parseArgs(["generate", "--all"]);
    expect(result.all).toBe(true);
    expect(result.sources).toEqual([]);
    expect(result.source).toBeUndefined();
  });

  it("--check and --accept-base flags are parsed correctly", () => {
    const result = parseArgs([
      "generate",
      "--source",
      "atlas",
      "--check",
      "--spec",
      "./swagger.json",
    ]);
    expect(result.check).toBe(true);
    expect(result.spec).toBe("./swagger.json");
    expect(result.sources).toEqual(["atlas"]);
  });

  it("sources array is empty when no --source given", () => {
    const result = parseArgs(["generate"]);
    expect(result.sources).toEqual([]);
    expect(result.source).toBeUndefined();
  });
});
