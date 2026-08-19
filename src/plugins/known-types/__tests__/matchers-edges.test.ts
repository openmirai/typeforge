import { describe, expect, it } from "vitest";

import { matchesDeclarativeRule, matchesExactProperties } from "../matchers";
import type { IRSchema } from "../../../parser/types";

describe("known-types matcher edge cases", () => {
  it("rejects non-object schemas", () => {
    expect(matchesExactProperties({ kind: "string" }, {}, ["id"])).toBe(false);
    expect(
      matchesDeclarativeRule(
        { kind: "ref", ref: "Missing" },
        {},
        { requireProperties: ["id"] }
      )
    ).toBe(false);
  });

  it("enforces maxPropertyCount and excludeProperties", () => {
    const schema: IRSchema = {
      kind: "object",
      properties: {
        a: { required: true, schema: { kind: "string" } },
        b: { required: true, schema: { kind: "string" } },
        legacy: { required: false, schema: { kind: "string" } },
      },
    };

    expect(
      matchesDeclarativeRule(
        schema,
        {},
        {
          maxPropertyCount: 2,
          requireProperties: ["a"],
        }
      )
    ).toBe(false);

    expect(
      matchesDeclarativeRule(
        schema,
        {},
        {
          excludeProperties: ["legacy"],
          requireProperties: ["a"],
        }
      )
    ).toBe(false);
  });
});
