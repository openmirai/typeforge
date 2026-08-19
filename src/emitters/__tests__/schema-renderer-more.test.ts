import { describe, expect, it } from "vitest";

import { renderSchemaType } from "../schema-renderer";
import type { IRSchema } from "../../parser/types";

describe("schema-renderer additional coverage", () => {
  it("formats enum literals including null and boolean", () => {
    const schema: IRSchema = {
      enum: ["a", 1, true, null],
      kind: "string",
    };
    expect(renderSchemaType(schema, { components: {} })).toContain("null");
    expect(renderSchemaType(schema, { components: {} })).toContain("true");
  });

  it("returns unknown for empty oneOf/allOf variants", () => {
    expect(
      renderSchemaType({ kind: "oneOf", oneOf: [] }, { components: {} })
    ).toBe("unknown");
    expect(
      renderSchemaType({ allOf: [], kind: "allOf" }, { components: {} })
    ).toBe("unknown");
  });

  it("renders typed additionalProperties maps", () => {
    const schema: IRSchema = {
      additionalProperties: { kind: "string" },
      kind: "object",
      "x-map-key-ref": "#/paths/~1status/put/parameters/0/schema",
    };
    const rawSpec = {
      paths: {
        "/status": {
          put: {
            parameters: [
              {
                schema: { enum: ["DRAFT", "LIVE"], type: "string" },
              },
            ],
          },
        },
      },
    };

    expect(
      renderSchemaType(schema, {
        components: {},
        rawSpec,
        resolveMapKeyRefs: true,
      })
    ).toContain('"DRAFT" | "LIVE"');
  });

  it("resolves map keys through array indices in JSON pointers", () => {
    const schema: IRSchema = {
      additionalProperties: { kind: "boolean" },
      kind: "object",
      "x-map-key-ref":
        "#/paths/~1items/get/responses/200/content/application~1json/schema/properties/flags/additionalProperties/x-enum-ref/0",
    };
    const rawSpec = {
      paths: {
        "/items": {
          get: {
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      properties: {
                        flags: {
                          additionalProperties: {
                            "x-enum-ref": [
                              { enum: ["A", "B"], type: "string" },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(
      renderSchemaType(schema, {
        components: {},
        rawSpec,
        resolveMapKeyRefs: true,
      })
    ).toContain("Record<");
  });
});
