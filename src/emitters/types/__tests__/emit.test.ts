import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emitBaseFile, emitTypeFiles } from "../index";
import { analyzeEnvelope } from "../../../envelope-guard/index";
import { parseSpec } from "../../../parser/index";

const fixtureRoot = fileURLToPath(
  new URL("../../../../test/fixtures", import.meta.url)
);
const generatedRoot = "/project/src/api/atlas/generated";

describe("emitTypeFiles", () => {
  it("wraps shared envelope responses with BaseResponse", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const analysis = analyzeEnvelope(source);
    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: analysis.mode,
      ...(analysis.shared === undefined
        ? {}
        : { sharedEnvelope: analysis.shared }),
      source,
      typesDir: `${generatedRoot}/types`,
    });

    const listType = files.find((file) =>
      file.relativePath.endsWith("widgets/GET.d.ts")
    );
    expect(listType?.content).toContain("BaseResponse<");
    expect(listType?.content).toContain("Omit<{");
    expect(listType?.content).toContain('"data">');
    expect(listType?.content).toContain("success: boolean");
    expect(listType?.content).toContain("timestamp: string");
    expect(listType?.content).toContain("Page number to return.");
    expect(listType?.content).toContain("Display title; closes *\\/ safely.");
    expect(emitBaseFile(analysis.shared!)).toContain(
      "Whether the request succeeded."
    );
  });

  it("preserves operation-specific fields beside envelope data", () => {
    const source = parseSpec(
      {
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/widgets": {
            post: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          data: { type: "string" },
                          warnings: {
                            type: "object",
                            properties: {
                              message: { type: "string" },
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
      },
      { pathPrefix: "/api/acme/v3" }
    );
    const analysis = analyzeEnvelope(source);
    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: analysis.mode,
      ...(analysis.shared === undefined
        ? {}
        : { sharedEnvelope: analysis.shared }),
      source,
      typesDir: `${generatedRoot}/types`,
    });

    expect(files[0]?.content).toContain("warnings?: {");
    expect(files[0]?.content).toContain("message?: string");
  });

  it("emits raw response types without BaseResponse wrapper", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/raw-cursor-list.json"), "utf8")
      ),
      { pathPrefix: "/api/orbit/v1" }
    );
    const analysis = analyzeEnvelope(source);
    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: analysis.mode,
      source,
      typesDir: `${generatedRoot}/types`,
    });

    const listType = files.find((file) =>
      file.relativePath.endsWith("artifacts/GET.d.ts")
    );
    expect(listType?.content).not.toContain("BaseResponse<");
    expect(listType?.content).toContain("GETApiOrbitV1ArtifactsResponse");
  });

  it("extends sort params when sortBy enum and config are present", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const listOperation = source.paths[0]?.operations[0];
    if (listOperation !== undefined) {
      listOperation.queryParams.push({
        name: "sortBy",
        required: false,
        schema: {
          enum: ["name", "createdAt"],
          kind: "string",
        },
      });
      listOperation.queryParams.push({
        name: "sortOrder",
        required: false,
        schema: { kind: "string" },
      });
    }

    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: "shared",
      queryExtends: {
        limit: "limit",
        page: "page",
        sortBy: "sortBy",
        sortImportPath: "./pagination",
        sortOrder: "sortOrder",
        sortTypeName: "SortParams",
      },
      source,
      typesDir: `${generatedRoot}/types`,
    });

    const listType = files.find((file) =>
      file.relativePath.endsWith("widgets/GET.d.ts")
    );
    expect(listType?.content).toContain('SortParams<"name" | "createdAt">');
    expect(listType?.content).not.toContain("Record<string");
  });

  it("emits alias body types and unknown responses", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/post-body.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const postOperation = source.paths[0]?.operations[0];
    if (postOperation?.requestBody !== undefined) {
      postOperation.requestBody.schema = {
        kind: "ref",
        ref: "ItemInput",
      };
    }

    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: "shared",
      source: {
        ...source,
        components: {
          schemas: {
            ItemInput: {
              kind: "string",
            },
          },
        },
      },
      typesDir: `${generatedRoot}/types`,
    });

    const postType = files.find((file) =>
      file.relativePath.endsWith("widgets/POST.d.ts")
    );
    expect(postType?.content).toContain(
      "export type POSTApiAcmeV3WidgetsBody = string"
    );

    const noResponseSource = parseSpec(
      {
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/ping": {
            get: { responses: { "204": { description: "empty" } } },
          },
        },
      },
      { pathPrefix: "/api/acme/v3" }
    );
    const pingFiles = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: "raw",
      source: noResponseSource,
      typesDir: `${generatedRoot}/types`,
    });
    expect(pingFiles[0]?.content).toContain("Response = unknown");
  });

  it("emits OpenAPI descriptions as TypeScript doc comments", () => {
    const source = parseSpec(
      {
        components: {
          schemas: {
            CreateWidget: {
              description: "Fields accepted when creating a widget.",
              properties: {
                displayName: {
                  description: "A human-readable name.\nClose */ safely.",
                  type: "string",
                },
              },
              required: ["displayName"],
              type: "object",
            },
            Widget: {
              description: "A widget returned by the API.",
              properties: {
                id: {
                  description: "Stable widget identifier.",
                  type: "string",
                },
                legacyName: {
                  deprecated: true,
                  description: "The former widget name.",
                  type: "string",
                },
              },
              required: ["id"],
              type: "object",
            },
          },
        },
        info: { title: "t", version: "1" },
        openapi: "3.0.0",
        paths: {
          "/api/acme/v3/widgets": {
            post: {
              deprecated: true,
              parameters: [
                {
                  description: "Client-provided correlation key.",
                  in: "query",
                  name: "requestId",
                  schema: { type: "string" },
                },
              ],
              requestBody: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/CreateWidget" },
                  },
                },
                description: "Widget creation payload.",
                required: true,
              },
              responses: {
                "201": {
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/Widget" },
                    },
                  },
                  description: "Widget created.",
                },
              },
            },
          },
        },
      },
      { pathPrefix: "/api/acme/v3" }
    );

    const files = emitTypeFiles({
      baseFile: `${generatedRoot}/base.ts`,
      envelopeMode: "raw",
      source,
      typesDir: `${generatedRoot}/types`,
    });
    const content = files[0]?.content ?? "";

    expect(content).toContain("Client-provided correlation key.");
    expect(content).toContain("Widget creation payload.");
    expect(content).toContain("A human-readable name.");
    expect(content).toContain("Close *\\/ safely.");
    expect(content).toContain("A widget returned by the API.");
    expect(content).toContain("Stable widget identifier.");
    expect(content).toContain("The former widget name.");
    expect(content.match(/@deprecated/g)).toHaveLength(4);
  });
});
