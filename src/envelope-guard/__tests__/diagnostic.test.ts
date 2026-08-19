import { describe, expect, it } from "vitest";

import { formatDriftError, formatMixedEnvelopeError } from "../diagnostic";
import type { EnvelopeShape, OperationEnvelope } from "../index";

describe("envelope-guard diagnostics", () => {
  it("formats mixed envelope errors with grouped shapes", () => {
    const shapeA: EnvelopeShape = {
      fields: [
        { kind: "boolean", name: "success", required: true },
        { kind: "generic", name: "data", required: false },
      ],
      schema: { kind: "object", properties: {} },
    };
    const shapeB: EnvelopeShape = {
      fields: [{ kind: "string", name: "id", required: true }],
      schema: { kind: "object", properties: {} },
    };
    const groups = new Map<string, Array<OperationEnvelope>>([
      ["a", [{ method: "GET", path: "/a", shape: shapeA }]],
      [
        "b",
        [
          { method: "GET", path: "/b", shape: shapeB },
          { method: "GET", path: "/c", shape: shapeB },
          { method: "GET", path: "/d", shape: shapeB },
          { method: "GET", path: "/e", shape: shapeB },
          { method: "GET", path: "/f", shape: shapeB },
          { method: "GET", path: "/g", shape: shapeB },
        ],
      ],
    ]);

    const message = formatMixedEnvelopeError("atlas", groups);
    expect(message).toContain("mixed envelope shapes");
    expect(message).toContain("Shape A");
    expect(message).toContain("and 1 more");
  });

  it("formats drift errors with conflict details", () => {
    const spec: EnvelopeShape = {
      fields: [
        { kind: "boolean", name: "success", required: true },
        { kind: "object", name: "error", required: false },
        { kind: "string", name: "timestamp", required: true },
      ],
      schema: { kind: "object", properties: {} },
    };

    const message = formatDriftError(
      "core",
      spec,
      "models.ts",
      "export interface BaseResponse<T> { success: boolean; timestamp: string; }",
      [
        { field: "error", issue: "missing" },
        { field: "requestId", issue: "extra" },
        {
          field: "timestamp",
          issue: "required-changed",
          spec: { kind: "string", name: "timestamp", required: true },
          user: { kind: "string", name: "timestamp", required: false },
        },
      ],
      [{ method: "GET", path: "/health", shape: spec }]
    );

    expect(message).toContain("base response mismatch");
    expect(message).toContain("present in spec, missing");
    expect(message).toContain("extra field");
    expect(message).toContain("required/optional mismatch");
    expect(message).toContain("/health");
  });
});
