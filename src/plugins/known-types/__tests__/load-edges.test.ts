import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadKnownTypeRules } from "../index";

describe("known-types load edge cases", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("loads declarative rule modifiers", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `known-types-edges-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/known-types.ts"),
      `export const knownTypes = [
  {
    name: "Inline",
    typeName: "InlineType",
    importPath: null,
    requireProperties: ["id"],
    excludeProperties: ["legacy"],
    maxPropertyCount: 3,
  },
];`,
      "utf8"
    );

    const rules = loadKnownTypeRules(cwd, "src/api");
    expect(rules).toHaveLength(1);
    expect(rules[0]?.importPath).toBeNull();
    expect(
      rules[0]?.matcher(
        {
          kind: "object",
          properties: {
            id: { required: true, schema: { kind: "string" } },
            label: { required: false, schema: { kind: "string" } },
          },
        },
        {}
      )
    ).toBe(true);
  });

  it("ignores invalid declarative blocks", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `known-types-invalid-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/known-types.ts"),
      `export const knownTypes = [
  { typeName: "MissingName" },
  { name: "MissingType" },
];`,
      "utf8"
    );

    expect(loadKnownTypeRules(cwd, "src/api")).toEqual([]);
  });
});
