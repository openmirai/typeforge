import { describe, expect, it } from "vitest";

import { RecursiveRefError } from "../recursive-ref-error";
import { renderSchemaType } from "../schema-renderer";
import type { IRSchema } from "../../parser/types";

describe("schema-renderer edge cases", () => {
  it("renders oneOf and allOf unions", () => {
    const oneOf: IRSchema = {
      kind: "oneOf",
      oneOf: [{ kind: "string" }, { kind: "number" }],
    };
    expect(renderSchemaType(oneOf, { components: {} })).toContain(" | ");

    const allOf: IRSchema = {
      allOf: [
        { kind: "object", properties: {} },
        { kind: "object", properties: {} },
      ],
      kind: "allOf",
    };
    expect(renderSchemaType(allOf, { components: {} })).toContain(" & ");
  });

  it("throws when max render depth is exceeded", () => {
    const deepArray: IRSchema = { kind: "array", items: { kind: "string" } };
    let nested: IRSchema = deepArray;
    for (let index = 0; index < 60; index += 1) {
      nested = { items: nested, kind: "array" };
    }

    expect(() =>
      renderSchemaType(nested, {
        components: {},
        maxDepth: 5,
        sourceKey: "atlas",
      })
    ).toThrow(RecursiveRefError);
  });

  it("renders nullable and boolean additionalProperties", () => {
    const nullableString: IRSchema = { kind: "string", nullable: true };
    expect(renderSchemaType(nullableString, { components: {} })).toContain(
      "| null"
    );

    const freeMap: IRSchema = {
      additionalProperties: true,
      kind: "object",
    };
    expect(renderSchemaType(freeMap, { components: {} })).toContain(
      "Record<string, unknown>"
    );
  });
});
