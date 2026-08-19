import { describe, expect, it } from "vitest";

import { createZodValidator } from "../zod";

describe("createZodValidator", () => {
  it("delegates to schema.parse without importing zod", () => {
    const schema = {
      parse(value: unknown) {
        if (
          typeof value !== "object" ||
          value === null ||
          !("id" in value) ||
          typeof value.id !== "string"
        ) {
          throw new Error("invalid");
        }
        return value as { id: string };
      },
    };

    const validate = createZodValidator(schema);
    expect(validate({ id: "1" })).toEqual({ id: "1" });
    expect(() => validate({ id: 1 })).toThrow("invalid");
  });
});
