import { describe, expect, it } from "vitest";

import {
  analyzeEnvelope,
  diffEnvelopeFields,
  parseUserBaseResponse,
} from "../index";
import { parseSpec } from "../../parser/index";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureRoot = fileURLToPath(
  new URL("../../../test/fixtures", import.meta.url)
);

describe("envelope-guard", () => {
  it("detects shared envelope mode", () => {
    const spec = JSON.parse(
      readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
    );
    const source = parseSpec(spec, { pathPrefix: "/api/acme/v3" });
    const analysis = analyzeEnvelope(source);
    expect(analysis.mode).toBe("shared");
    expect(analysis.shared).toBeDefined();
  });

  it("reports drift against user BaseResponse", () => {
    const user = parseUserBaseResponse(`
      export interface BaseResponse<T> {
        success: boolean;
        data: T;
        timestamp: string;
        error?: string;
      }
    `);
    expect(user).toBeDefined();
    const spec = JSON.parse(
      readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
    );
    const source = parseSpec(spec, { pathPrefix: "/api/acme/v3" });
    const analysis = analyzeEnvelope(source);
    expect(analysis.shared).toBeDefined();
    const diffs = diffEnvelopeFields(analysis.shared!, user!);
    expect(diffs.some((diff) => diff.field === "error")).toBe(true);
  });
});
