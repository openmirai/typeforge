import { describe, expect, it } from "vitest";

import type { IRSchema } from "../../parser/types";
import {
  getFunctionFilePath,
  getTypeFilePath,
  isSuccessStatusCode,
  pathToEnumName,
  pathToFunctionName,
  pathToRouteValue,
  schemaKindLabel,
} from "../naming";

describe("naming utils", () => {
  it("converts paths to enum names", () => {
    expect(pathToEnumName("/api/acme/v3/widgets/{slug}")).toBe(
      "API_ACME_V3_WIDGETS_SLUG"
    );
  });

  it("converts paths to route values with optional api prefix strip", () => {
    expect(pathToRouteValue("/api/acme/v3/widgets/{slug}", true)).toBe(
      "/acme/v3/widgets/:slug"
    );
    expect(pathToRouteValue("/api/acme/v3/widgets/{slug}", false)).toBe(
      "/api/acme/v3/widgets/:slug"
    );
  });

  it("converts clean paths to function names", () => {
    expect(pathToFunctionName("api/acme/v3/widgets", "get")).toBe(
      "getApiAcmeV3Widgets"
    );
    expect(pathToFunctionName("api/acme/v3/widgets/[slug]", "delete")).toBe(
      "deleteApiAcmeV3WidgetsSlug"
    );
  });

  it("builds generated file paths", () => {
    expect(getFunctionFilePath("api/acme/v3/widgets/[slug]", "get")).toBe(
      "api/acme/v3/widgets/[slug]/GET.ts"
    );
    expect(getTypeFilePath("api/acme/v3/widgets", "post")).toBe(
      "api/acme/v3/widgets/POST.d.ts"
    );
  });

  it("labels schema kinds for envelope analysis", () => {
    expect(schemaKindLabel({ kind: "string" })).toBe("string");
    expect(schemaKindLabel({ enum: ["a"], kind: "string" })).toBe("enum");
    expect(schemaKindLabel({ kind: "ref", ref: "Foo" })).toBe("ref:Foo");
    expect(schemaKindLabel({ kind: "oneOf", oneOf: [] })).toBe("oneOf");
  });

  it("detects success status codes", () => {
    expect(isSuccessStatusCode("200")).toBe(true);
    expect(isSuccessStatusCode("204")).toBe(true);
    expect(isSuccessStatusCode("404")).toBe(false);
    expect(isSuccessStatusCode("abc")).toBe(false);
  });
});
