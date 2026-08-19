import { existsSync, readFileSync, rmSync } from "node:fs";
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

describe("integration: generate options", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates when models.ts matches the spec envelope", async () => {
    const root = join(fixtureRoot, "layouts", `models-match-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  data?: T;
  success: boolean;
  timestamp: string;
}`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    expect(existsSync(join(root, "src/api/atlas/generated/base.ts"))).toBe(
      true
    );
  });

  it("generates when models.ts has no BaseResponse interface", async () => {
    const root = join(fixtureRoot, "layouts", `models-plain-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: "export type User = { id: string };",
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    expect(existsSync(join(root, "src/api/atlas/generated/routes.ts"))).toBe(
      true
    );
  });

  it("accept-base succeeds when models.ts is missing", async () => {
    const root = join(fixtureRoot, "layouts", `accept-no-models-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({
      acceptBase: true,
      cwd: root,
      sourceKey: "atlas",
    });
    expect(existsSync(join(root, "src/api/atlas/generated/base.ts"))).toBe(
      true
    );
  });

  it("honors source.ts ignorePaths and render options", async () => {
    const root = join(fixtureRoot, "layouts", `source-opts-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceConfig: `export default {
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  ignorePaths: ["/api/acme/v3/widgets/{slug}"],
  resolveMapKeyRefs: false,
  maxRenderDepth: 12,
};`,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const routes = readFileSync(
      join(root, "src/api/atlas/generated/routes.ts"),
      "utf8"
    );
    expect(routes).toContain("/acme/v3/widgets");
    expect(routes).not.toContain("/acme/v3/widgets/:slug");
  });

  it("resolves an explicit --spec flag path", async () => {
    const root = join(fixtureRoot, "layouts", `spec-flag-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: "{}",
    });

    await generateForSource({
      cwd: root,
      sourceKey: "atlas",
      specFlag: join(fixtureRoot, "specs/envelope-list.json"),
    });

    expect(
      existsSync(
        join(
          root,
          "src/api/atlas/generated/functions/api/acme/v3/widgets/GET.ts"
        )
      )
    ).toBe(true);
  });
});
