import { describe, expect, it } from "vitest";

import { defineSourceConfig } from "../define";
import type { SourceConfig } from "../types";

describe("defineSourceConfig", () => {
  it("returns the same config object for type checking", () => {
    const config: SourceConfig = {
      pathPrefix: "/api/acme/v3",
      generationMode: "authoritative",
    };

    expect(defineSourceConfig(config)).toBe(config);
  });
});
