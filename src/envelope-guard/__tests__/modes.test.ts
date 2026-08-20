import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { analyzeEnvelope, getPrimaryEnvelopeShape } from "../index";
import { parseSpec } from "../../parser/index";

const fixtureRoot = fileURLToPath(
  new URL("../../../test/fixtures", import.meta.url)
);

describe("envelope-guard classification", () => {
  it("detects raw mode for orbit-style responses", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/raw-cursor-list.json"), "utf8")
      ),
      { pathPrefix: "/api/orbit/v1" }
    );
    expect(analyzeEnvelope(source).mode).toBe("raw");
  });

  it("detects mixed envelope mode", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/mixed-envelope.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    expect(analyzeEnvelope(source).mode).toBe("mixed");
    expect(analyzeEnvelope(source).groups.size).toBeGreaterThan(1);
    const primary = getPrimaryEnvelopeShape(analyzeEnvelope(source));
    expect(primary?.fields.some((field) => field.name === "data")).toBe(true);
  });

  it("handles empty specs without operations", () => {
    const source = parseSpec(
      JSON.parse(readFileSync(join(fixtureRoot, "specs/empty.json"), "utf8")),
      { pathPrefix: "/api/acme/v3" }
    );
    expect(analyzeEnvelope(source).operations).toHaveLength(0);
  });
});
