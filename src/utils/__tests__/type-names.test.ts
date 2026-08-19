import { describe, expect, it } from "vitest";

import type { IROperation, IRSchema } from "../../parser/types";
import {
  getFunctionTypeName,
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

describe("type-names utils", () => {
  it("builds function type names from clean paths", () => {
    expect(getFunctionTypeName("api/acme/v3/widgets", "get")).toBe(
      "GETApiAcmeV3Widgets"
    );
    expect(getFunctionTypeName("api/acme/v3/widgets/[slug]", "delete")).toBe(
      "DELETEApiAcmeV3WidgetsSlug"
    );
  });

  it("detects meaningful request bodies", () => {
    const emptyBody = operation({
      method: "post",
      requestBody: {
        required: true,
        schema: { kind: "object", properties: {} },
      },
    });
    const realBody = operation({
      method: "post",
      requestBody: {
        required: true,
        schema: {
          kind: "object",
          properties: {
            name: { required: true, schema: { kind: "string" } },
          },
        },
      },
    });

    expect(hasMeaningfulRequestBody(emptyBody)).toBe(false);
    expect(hasMeaningfulRequestBody(realBody)).toBe(true);
    expect(hasMeaningfulRequestBody(operation({ method: "get" }))).toBe(false);
  });

  it("finds first success response schema", () => {
    const schema: IRSchema = { kind: "string" };
    const op = operation({
      responses: [
        { schema: { kind: "number" }, statusCode: "400" },
        { schema, statusCode: "200" },
      ],
    });
    expect(getSuccessResponseSchema(op)).toBe(schema);
  });
});
