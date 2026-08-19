import { describe, expect, it } from "vitest";

import { parseSchema, parseSpec } from "../index";

describe("parseSchema edge cases", () => {
  it("returns unknown for non-object input", () => {
    expect(parseSchema("nope").kind).toBe("unknown");
  });

  it("parses composition and numeric schemas", () => {
    expect(parseSchema({ oneOf: [{ type: "string" }] }).kind).toBe("oneOf");
    expect(parseSchema({ anyOf: [{ type: "number" }] }).kind).toBe("anyOf");
    expect(parseSchema({ allOf: [{ type: "object" }] }).kind).toBe("allOf");

    const integer = parseSchema({
      enum: [1, 2],
      format: "int32",
      nullable: true,
      type: "integer",
      "x-map-key-ref": "#/components/schemas/Key",
    });
    expect(integer.kind).toBe("number");
    expect(integer.enum).toEqual([1, 2]);
    expect(integer["x-map-key-ref"]).toBe("#/components/schemas/Key");
  });

  it("infers object schemas without explicit type", () => {
    const schema = parseSchema({
      additionalProperties: { type: "string" },
    });
    expect(schema.kind).toBe("object");
  });

  it("respects ignorePaths during parseSpec", () => {
    const source = parseSpec(
      {
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/widgets": {
            get: { responses: { "200": { description: "ok" } } },
          },
          "/api/orbit/v1/health": {
            get: { responses: { "200": { description: "ok" } } },
          },
        },
      },
      { ignorePaths: ["/api/orbit/v1/health"], pathPrefix: "/api/acme/v3" }
    );
    expect(source.paths.map((path) => path.path)).toEqual([
      "/api/acme/v3/widgets",
    ]);
  });
});
