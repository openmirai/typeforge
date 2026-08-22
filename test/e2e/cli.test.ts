import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../helpers/cli";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);

describe("e2e cli init", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("writes axios layout files", () => {
    const root = join(fixtureRoot, "layouts", `cli-init-axios-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, "src/api"), { recursive: true });
    writeFileSync(
      join(root, "typeforge.json"),
      JSON.stringify({ apiRoot: "src/api" }),
      "utf8"
    );

    const result = runCli(root, [
      "init",
      "--source",
      "atlas",
      "--client",
      "axios",
      "--layout",
      "monolith",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("created");
    const http = readFileSync(join(root, "src/api/http.ts"), "utf8");
    expect(http).toContain("createAxiosAdapter");
    expect(existsSync(join(root, "src/api/known-types.ts"))).toBe(true);
  });

  it("does not overwrite existing http.ts on second init", () => {
    const root = join(fixtureRoot, "layouts", `cli-init-skip-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      httpContent: "// keep me\nexport const httpFetch = {} as never;\n",
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    const result = runCli(root, [
      "init",
      "--source",
      "atlas",
      "--client",
      "fetch",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("skipped");
    expect(readFileSync(join(root, "src/api/http.ts"), "utf8")).toContain(
      "// keep me"
    );
  });
});

describe("e2e cli generate", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates from committed snapshot", () => {
    const root = join(fixtureRoot, "layouts", `cli-generate-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    const result = runCli(root, ["generate", "--source", "atlas"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("generated");
    expect(existsSync(join(root, "src/api/atlas/generated/routes.ts"))).toBe(
      true
    );
  });

  it("resolves --spec flag", () => {
    const root = join(fixtureRoot, "layouts", `cli-spec-flag-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: "{}",
    });

    const specPath = join(fixtureRoot, "specs/envelope-list.json");
    const result = runCli(root, [
      "generate",
      "--source",
      "atlas",
      "--spec",
      specPath,
    ]);
    expect(result.exitCode).toBe(0);
  });

  it("reports missing spec with resolution strategies", () => {
    const root = join(fixtureRoot, "layouts", `cli-missing-spec-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });
    rmSync(join(root, "src/api/atlas/spec.json"));

    const result = runCli(root, ["generate", "--source", "atlas"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('No OpenAPI spec found for source "atlas"');
    expect(result.stderr).toContain("--spec");
  });

  it("check exits 1 when output is stale", () => {
    const root = join(fixtureRoot, "layouts", `cli-check-stale-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    expect(runCli(root, ["generate", "--source", "atlas"]).exitCode).toBe(0);

    const routesPath = join(root, "src/api/atlas/generated/routes.ts");
    const original = readFileSync(routesPath, "utf8");
    rmSync(routesPath);

    const result = runCli(root, ["check", "--source", "atlas"]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("stale");

    writeFileSync(routesPath, original, "utf8");
    expect(runCli(root, ["check", "--source", "atlas"]).exitCode).toBe(0);
  });

  it("rejects --accept-base with --check", () => {
    const root = join(fixtureRoot, "layouts", `cli-check-accept-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    const result = runCli(root, [
      "generate",
      "--source",
      "atlas",
      "--check",
      "--accept-base",
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("not allowed with --check");
  });
});
