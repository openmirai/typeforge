import { describe, expect, it } from "vitest";

import {
  renderPathParamType,
  renderPathParamTypeFromSchema,
  resolvePathParamSchemas,
} from "../path-params";

describe("path-params utils", () => {
  it("renders enum path param unions", () => {
    expect(
      renderPathParamTypeFromSchema({
        enum: ["alpha", "beta"],
        kind: "string",
      })
    ).toBe('"alpha" | "beta"');
  });

  it("resolves schemas from path operations", () => {
    const schemas = resolvePathParamSchemas({
      cleanPath: "api/acme/v3/widgets/[phase]",
      operations: [
        {
          method: "put",
          pathParams: [
            {
              name: "phase",
              schema: { enum: ["alpha", "beta"], kind: "string" },
            },
          ],
          queryParams: [],
          responses: [],
        },
      ],
      path: "/api/acme/v3/widgets/{phase}",
    });

    expect(renderPathParamType(schemas, "phase")).toBe('"alpha" | "beta"');
  });
});
