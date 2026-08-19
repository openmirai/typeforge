import { describe, expect, it } from "vitest";

import { RecursiveRefError } from "../recursive-ref-error";
import { renderSchemaType } from "../schema-renderer";
import type { IRSchema } from "../../parser/types";

describe("schema-renderer coverage gaps", () => {
  it("ignores invalid map-key pointers and resolves component refs", () => {
    const schema: IRSchema = {
      additionalProperties: { kind: "string" },
      kind: "object",
      "x-map-key-ref": "not-a-pointer",
    };
    expect(renderSchemaType(schema, { components: {} })).toContain(
      "Record<string, string>"
    );

    const withComponent: IRSchema = {
      additionalProperties: { kind: "boolean" },
      kind: "object",
      "x-map-key-ref": "#/components/schemas/StatusKey",
    };
    expect(
      renderSchemaType(withComponent, {
        components: {
          StatusKey: { enum: ["A", "B"], kind: "string" },
        },
      })
    ).toContain('"A" | "B"');
  });

  it("skips map-key resolution when disabled", () => {
    const schema: IRSchema = {
      additionalProperties: { kind: "number" },
      kind: "object",
      "x-map-key-ref": "#/components/schemas/StatusKey",
    };
    expect(
      renderSchemaType(schema, {
        components: { StatusKey: { enum: ["A"], kind: "string" } },
        resolveMapKeyRefs: false,
      })
    ).toBe("Record<string, number>");
  });

  it("throws recursive ref errors with ref stacks", () => {
    const node: IRSchema = { kind: "ref", ref: "Node" };
    expect(() =>
      renderSchemaType(node, {
        components: { Node: node },
        refStack: ["Node"],
        sourceKey: "atlas",
      })
    ).toThrow(RecursiveRefError);
  });
});
