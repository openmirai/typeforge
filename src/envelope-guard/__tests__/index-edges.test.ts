import { describe, expect, it } from "vitest";

import {
  analyzeEnvelope,
  buildBaseResponseInterface,
  collectOperationEnvelopes,
  diffEnvelopeFields,
} from "../index";
import { parseSpec } from "../../parser/index";

describe("envelope-guard edge cases", () => {
  it("skips operations without success schemas or envelope shapes", () => {
    const source = parseSpec(
      {
        openapi: "3.0.0",
        info: { title: "t", version: "1" },
        paths: {
          "/api/acme/v3/ping": {
            get: { responses: { "404": { description: "missing" } } },
          },
          "/api/orbit/v1/raw": {
            get: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: { type: "string" },
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

    expect(collectOperationEnvelopes(source)).toHaveLength(0);
    expect(analyzeEnvelope(source).mode).toBe("raw");
  });

  it("reports missing and required-changed drift", () => {
    const spec = {
      fields: [
        { kind: "boolean", name: "success", required: true },
        { kind: "string", name: "timestamp", required: true },
      ],
      schema: { kind: "object" as const, properties: {} },
    };
    const user = {
      fields: [{ kind: "boolean", name: "success", required: false }],
      sourcePath: "models.ts",
    };

    const diffs = diffEnvelopeFields(spec, user);
    expect(diffs.some((diff) => diff.issue === "missing")).toBe(true);
    expect(diffs.some((diff) => diff.issue === "required-changed")).toBe(true);
  });

  it("falls back to unknown field types when schema metadata is missing", () => {
    const iface = buildBaseResponseInterface({
      fields: [{ kind: "string", name: "requestId", required: false }],
      schema: { kind: "object", properties: {} },
    });
    expect(iface).toContain("requestId?: unknown");
  });
});
