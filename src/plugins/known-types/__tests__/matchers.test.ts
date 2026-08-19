import { describe, expect, it } from "vitest";

import { matchesDeclarativeRule, matchesExactProperties } from "../matchers";
import type { IRSchema } from "../../../parser/types";

const components: Record<string, IRSchema> = {};

function objectSchema(
  properties: Record<string, { schema: IRSchema; required?: boolean }>
): IRSchema {
  const props: IRSchema["properties"] = {};
  for (const [name, property] of Object.entries(properties)) {
    props[name] = {
      required: property.required ?? false,
      schema: property.schema,
    };
  }
  return { kind: "object", properties: props };
}

describe("known-types matchers", () => {
  it("matches exactProperties", () => {
    const schema = objectSchema({
      id: { schema: { kind: "string" } },
      label: { schema: { kind: "string" } },
    });
    expect(matchesExactProperties(schema, components, ["id", "label"])).toBe(
      true
    );
    expect(
      matchesExactProperties(schema, components, ["id", "label", "extra"])
    ).toBe(false);
  });

  it("matches requireProperties and excludeProperties", () => {
    const schema = objectSchema({
      file: { schema: { kind: "object", properties: {} } },
      id: { schema: { kind: "string" } },
      url: { schema: { kind: "string" } },
    });

    expect(
      matchesDeclarativeRule(schema, components, {
        requireProperties: ["id", "url", "file"],
      })
    ).toBe(true);

    expect(
      matchesDeclarativeRule(schema, components, {
        excludeProperties: ["name"],
        requireProperties: ["id", "url"],
      })
    ).toBe(true);

    expect(
      matchesDeclarativeRule(schema, components, {
        excludeProperties: ["name"],
        requireProperties: ["id", "url", "file", "sortOrder"],
      })
    ).toBe(false);
  });

  it("requires at least one pattern field", () => {
    const schema = objectSchema({
      id: { schema: { kind: "string" } },
    });
    expect(matchesDeclarativeRule(schema, components, {})).toBe(false);
  });
});
