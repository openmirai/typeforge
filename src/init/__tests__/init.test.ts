import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { initProject } from "../index";

describe("initProject", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("creates monolith source layout with fetch adapter", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `init-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });

    const result = initProject({
      client: "fetch",
      cwd,
      layout: "monolith",
      sourceKey: "atlas",
    });

    expect(result.created.length).toBeGreaterThan(0);
    expect(result.created.some((file) => file.endsWith("known-types.ts"))).toBe(
      true
    );
  });

  it("creates packages layout with default apiRoot", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `init-packages-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });

    const result = initProject({
      client: "axios",
      cwd,
      layout: "packages",
      sourceKey: "core",
    });

    expect(
      result.created.some((file) =>
        file.includes("packages/utils/src/api/http.ts")
      )
    ).toBe(true);
  });

  it("skips existing files on second init", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `init-skip-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });

    initProject({ client: "custom", cwd, sourceKey: "core" });
    const second = initProject({ client: "axios", cwd, sourceKey: "core" });
    expect(second.skipped.length).toBeGreaterThan(0);
  });
});
