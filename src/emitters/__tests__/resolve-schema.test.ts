import { describe, expect, it } from "vitest";

import { refNameFromSchema, resolveRef } from "../resolve-schema";
import type { IRSchema } from "../../parser/types";

describe("resolve-schema", () => {
  const components: Record<string, IRSchema> = {
    Item: {
      kind: "object",
      properties: {
        id: { required: true, schema: { kind: "string" } },
      },
    },
  };

  it("resolves component refs", () => {
    const resolved = resolveRef(
      { kind: "ref", ref: "#/components/schemas/Item" },
      components
    );
    expect(resolved.kind).toBe("object");
  });

  it("returns unknown for missing refs", () => {
    const resolved = resolveRef(
      { kind: "ref", ref: "#/components/schemas/Missing" },
      components
    );
    expect(resolved.kind).toBe("unknown");
  });

  it("returns schema unchanged when not a ref", () => {
    const schema: IRSchema = { kind: "string" };
    expect(resolveRef(schema, components)).toBe(schema);
  });

  it("extracts ref names", () => {
    expect(
      refNameFromSchema({ kind: "ref", ref: "#/components/schemas/Item" })
    ).toBe("Item");
    expect(refNameFromSchema({ kind: "string" })).toBeUndefined();
  });
});
