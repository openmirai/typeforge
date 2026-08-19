import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { RecursiveRefError } from "../recursive-ref-error";
import { renderSchemaType } from "../schema-renderer";
import { parseSpec } from "../../parser/index";
import { matchesDeclarativeRule } from "../../plugins/known-types/matchers";
import type { KnownTypeRule } from "../../plugins/known-types/types";
import { isJsonObject } from "../../json/types";

const fixtureRoot = fileURLToPath(
  new URL("../../../test/fixtures", import.meta.url)
);

const blobOverrideRule: KnownTypeRule = {
  importPath: "./blob/types",
  name: "BlobAsset",
  typeName: "BlobAsset",
  matcher: (schema, componentSchemas) =>
    matchesDeclarativeRule(schema, componentSchemas, {
      exactProperties: ["handle", "uri", "payload"],
    }),
};

describe("schema-renderer", () => {
  it("errors on recursive schema references", () => {
    const raw = JSON.parse(
      readFileSync(join(fixtureRoot, "specs/recursive-node.json"), "utf8")
    );
    const source = parseSpec(raw, { pathPrefix: "/api/acme/v3" });
    const operation = source.paths[0]?.operations[0];
    const schema = operation?.responses[0]?.schema;
    expect(schema).toBeDefined();

    expect(() =>
      renderSchemaType(schema!, {
        components: source.components.schemas,
        schemaPath: "GET /api/acme/v3/nodes",
        sourceKey: "test",
      })
    ).toThrow(RecursiveRefError);
  });

  it("applies user known-type overrides by property pattern", () => {
    const raw = JSON.parse(
      readFileSync(join(fixtureRoot, "specs/blob-endpoint.json"), "utf8")
    );
    const source = parseSpec(raw, { pathPrefix: "/api/acme/v3" });
    const operation = source.paths[0]?.operations[0];
    const schema = operation?.responses[0]?.schema;
    expect(schema).toBeDefined();

    const output = renderSchemaType(schema!, {
      components: source.components.schemas,
      knownTypeImports: new Map(),
      knownTypes: [blobOverrideRule],
      schemaPath: "GET /api/acme/v3/blobs/{handle}",
      sourceKey: "test",
    });

    expect(output).toContain("BlobAsset");
    expect(output).not.toContain("videoId");
  });

  it("renders typed map keys from x-map-key-ref", () => {
    const raw = JSON.parse(
      readFileSync(join(fixtureRoot, "specs/map-key-ref.json"), "utf8")
    );
    expect(isJsonObject(raw)).toBe(true);
    const source = parseSpec(raw, { pathPrefix: "/api/acme/v3" });
    const operation = source.paths[1]?.operations[0];
    const schema = operation?.responses[0]?.schema;
    expect(schema).toBeDefined();

    const output = renderSchemaType(schema!, {
      components: source.components.schemas,
      rawSpec: raw,
      resolveMapKeyRefs: true,
      schemaPath: "GET /api/acme/v3/registry/clauses",
      sourceKey: "test",
    });

    expect(output).toContain('"ALPHA_NOTICE" | "BETA_NOTICE"');
    expect(output).toContain("Record<");
  });
});
