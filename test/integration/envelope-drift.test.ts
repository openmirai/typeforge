import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { generateForSource } from "../../src/generate/index";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);

describe("integration: envelope drift", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("throws when models.ts BaseResponse drifts from spec", async () => {
    const root = join(fixtureRoot, "layouts", `drift-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  data: T;
  error?: string;
  success: boolean;
  timestamp: string;
}`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await expect(
      generateForSource({ cwd: root, sourceKey: "atlas" })
    ).rejects.toThrow(/base response mismatch/i);
  });

  it("accept-base patches models.ts and generates base.ts", async () => {
    const root = join(fixtureRoot, "layouts", `accept-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  data: T;
  error?: string;
  success: boolean;
  timestamp: string;
}`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({
      acceptBase: true,
      cwd: root,
      sourceKey: "atlas",
    });

    const models = readFileSync(join(root, "src/api/models.ts"), "utf8");
    expect(models).toContain("data?: T");
    expect(models).not.toContain("error?: string");
  });
});

describe("integration: runtime validation", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("supports validateResponse in generated caller config", async () => {
    const root = join(fixtureRoot, "layouts", `validate-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });

    const fn = readFileSync(
      join(
        root,
        "src/api/atlas/generated/functions/api/acme/v3/widgets/GET.ts"
      ),
      "utf8"
    );
    expect(fn).toContain("HTTPFetchConfig<GETApiAcmeV3WidgetsParams>");
    expect(fn).toContain("config?: Omit<HTTPFetchConfig");
  });
});
