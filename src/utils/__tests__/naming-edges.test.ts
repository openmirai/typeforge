import { describe, expect, it } from "vitest";

import {
  getFunctionFilePath,
  getTypeFilePath,
  schemaKindLabel,
} from "../naming";
import type { IRSchema } from "../../parser/types";

describe("naming utils edge cases", () => {
  it("builds nested generated file paths", () => {
    expect(getFunctionFilePath("api/acme/v3/widgets/[id]", "get")).toBe(
      "api/acme/v3/widgets/[id]/GET.ts"
    );
    expect(getTypeFilePath("api/acme/v3/widgets/[id]", "get")).toBe(
      "api/acme/v3/widgets/[id]/GET.d.ts"
    );
  });

  it("labels object schemas", () => {
    const schema: IRSchema = { kind: "object", properties: {} };
    expect(schemaKindLabel(schema)).toBe("object");
  });
});
