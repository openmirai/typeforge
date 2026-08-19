import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { generateForSource } from "../../src/generate/index";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const mapKeySpec = readFileSync(
  join(fixtureRoot, "specs/map-key-ref.json"),
  "utf8"
);
const mediaSpec = readFileSync(
  join(fixtureRoot, "specs/blob-endpoint.json"),
  "utf8"
);

describe("integration: feature coverage", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates typed map keys from x-map-key-ref", async () => {
    const root = join(fixtureRoot, "layouts", `map-key-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: mapKeySpec,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });

    const typeFile = readFileSync(
      join(
        root,
        "src/api/atlas/generated/types/api/acme/v3/registry/clauses/GET.d.ts"
      ),
      "utf8"
    );
    expect(typeFile).toMatch(/Record<[^,]+,/);
    expect(
      existsSync(
        join(
          root,
          "src/api/atlas/generated/functions/api/acme/v3/registry/clauses/GET.ts"
        )
      )
    ).toBe(true);
  });

  it("applies user known-types overrides during generation", async () => {
    const root = join(fixtureRoot, "layouts", `known-types-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      knownTypesContent: `export const knownTypes = [
  {
    name: "BlobAsset",
    typeName: "BlobAsset",
    importPath: "./blob/types",
    exactProperties: ["handle", "uri", "payload"],
  },
];`,
      root,
      sourceKey: "atlas",
      specContent: mediaSpec,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });

    const typeFile = readFileSync(
      join(
        root,
        "src/api/atlas/generated/types/api/acme/v3/blobs/[handle]/GET.d.ts"
      ),
      "utf8"
    );
    expect(typeFile).toContain("BlobAsset");
    expect(typeFile).toContain('./blob/types"');
  });
});
