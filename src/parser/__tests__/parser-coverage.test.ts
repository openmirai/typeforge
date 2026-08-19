import { describe, expect, it } from "vitest";

import { parseSpec } from "../index";

describe("parseSpec coverage gaps", () => {
  it("handles malformed path containers and swagger param shapes", () => {
    const source = parseSpec(
      {
        swagger: "2.0",
        info: { title: "t", version: "1" },
        paths: "not-an-object",
      },
      {}
    );
    expect(source.paths).toEqual([]);

    const swagger = parseSpec(
      {
        swagger: "2.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/widgets": "invalid",
          "/api/acme/v3/ping": {
            get: {
              parameters: [
                {
                  enum: ["a", "b"],
                  format: "uuid",
                  in: "query",
                  name: "mode",
                  type: "string",
                },
                {
                  in: "body",
                  name: "body",
                  schema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                  },
                },
              ],
              responses: {
                "200": "invalid-response",
                "404": { description: "missing" },
              },
            },
          },
        },
      },
      { pathPrefix: "/api/acme/v3" }
    );

    expect(swagger.paths).toHaveLength(1);
    expect(
      swagger.paths[0]?.operations[0]?.queryParams[0]?.schema.enum
    ).toEqual(["a", "b"]);
  });

  it("parses object schemas with boolean additionalProperties", () => {
    const source = parseSpec(
      {
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/map": {
            get: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        additionalProperties: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      { pathPrefix: "/api/acme/v3" }
    );

    const responseSchema = source.paths[0]?.operations[0]?.responses[0]?.schema;
    expect(responseSchema?.kind).toBe("object");
    expect(responseSchema?.additionalProperties).toBe(true);
  });
});
