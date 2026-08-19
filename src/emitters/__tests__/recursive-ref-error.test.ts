import { describe, expect, it } from "vitest";

import { RecursiveRefError } from "../recursive-ref-error";

describe("RecursiveRefError", () => {
  it("formats cycle and fix guidance", () => {
    const error = new RecursiveRefError(
      "core-v2",
      ["Node", "Node"],
      "GET /api/acme/v3/nodes.data"
    );

    expect(error).toBeInstanceOf(RecursiveRefError);
    expect(error.message).toContain('source "core-v2"');
    expect(error.message).toContain("Node → Node");
    expect(error.message).toContain("known-types.ts");
  });
});
