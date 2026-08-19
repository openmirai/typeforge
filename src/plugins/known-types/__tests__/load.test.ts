import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadKnownTypeRules } from "../index";

describe("loadUserKnownTypes", () => {
  it("loads declarative rules from known-types.ts", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `known-types-${Date.now()}`
    );
    mkdirSync(join(cwd, "src/api"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/known-types.ts"),
      `export const knownTypes = [
  {
    name: "BlobAsset",
    typeName: "BlobAsset",
    importPath: "./media/types",
    exactProperties: ["id", "url", "file"],
  },
];`,
      "utf8"
    );

    const rules = loadKnownTypeRules(cwd, "src/api");
    expect(rules).toHaveLength(1);
    expect(rules[0]?.typeName).toBe("BlobAsset");
    expect(rules[0]?.importPath).toBe("./media/types");
  });

  it("returns empty array when known-types.ts is missing", () => {
    const rules = loadKnownTypeRules(process.cwd(), "src/missing-api-root");
    expect(rules).toEqual([]);
  });
});
