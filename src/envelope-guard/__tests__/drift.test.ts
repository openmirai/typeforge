import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  analyzeEnvelope,
  buildBaseResponseInterface,
  diffEnvelopeFields,
  getDataFieldSchema,
  parseUserBaseResponse,
} from "../index";
import { parseSpec } from "../../parser/index";

const fixtureRoot = fileURLToPath(
  new URL("../../../test/fixtures", import.meta.url)
);

describe("envelope drift", () => {
  it("builds BaseResponse interface from spec envelope", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const analysis = analyzeEnvelope(source);
    expect(analysis.shared).toBeDefined();
    const iface = buildBaseResponseInterface(analysis.shared!);
    expect(iface).toContain("export interface BaseResponse<T>");
    expect(iface).toContain("data?: T");
    expect(getDataFieldSchema(analysis.shared!)).toBeDefined();
  });

  it("parses user BaseResponse without generic parameter", () => {
    const user = parseUserBaseResponse(`
      export interface BaseResponse {
        success: boolean;
        timestamp: string;
      }
    `);
    expect(user?.fields.map((field) => field.name)).toEqual([
      "success",
      "timestamp",
    ]);
  });

  it("reports extra, missing, and type-changed fields", () => {
    const specFields = {
      fields: [
        { kind: "boolean", name: "success", required: true },
        { kind: "object", name: "error", required: false },
        { kind: "string", name: "timestamp", required: true },
      ],
      schema: { kind: "object" as const, properties: {} },
    };
    const user = parseUserBaseResponse(`
      export interface BaseResponse<T> {
        success: boolean;
        timestamp: string;
        error?: string;
        requestId?: string;
      }
    `);
    expect(user).toBeDefined();
    const diffs = diffEnvelopeFields(specFields, user!);
    expect(diffs.some((diff) => diff.issue === "type-changed")).toBe(true);
    expect(diffs.some((diff) => diff.issue === "extra")).toBe(true);
  });
});
