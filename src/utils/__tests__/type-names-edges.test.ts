import { describe, expect, it } from "vitest";

import type { IROperation, IRSchema } from "../../parser/types";
import {
  getSuccessResponseSchema,
  hasMeaningfulRequestBody,
} from "../type-names";

function operation(partial: Partial<IROperation>): IROperation {
  return {
    method: "get",
    pathParams: [],
    queryParams: [],
    responses: [],
    ...partial,
  };
}

describe("type-names edge cases", () => {
  it("treats unknown and empty object schemas as empty bodies", () => {
    expect(
      hasMeaningfulRequestBody(
        operation({
          method: "post",
          requestBody: {
            required: true,
            schema: { kind: "unknown" },
          },
        })
      )
    ).toBe(false);
  });

  it("returns undefined when no success response exists", () => {
    expect(
      getSuccessResponseSchema(
        operation({
          responses: [{ schema: { kind: "string" }, statusCode: "500" }],
        })
      )
    ).toBeUndefined();
  });

  it("accepts alias body schemas", () => {
    const aliasSchema: IRSchema = { kind: "ref", ref: "ItemInput" };
    expect(
      hasMeaningfulRequestBody(
        operation({
          method: "post",
          requestBody: { required: true, schema: aliasSchema },
        })
      )
    ).toBe(true);
  });
});
