import type { IRSchema } from "../../parser/types";
import { resolveRef } from "../../emitters/resolve-schema";
import type { DeclarativeKnownTypeRule } from "./types";

function resolveObjectSchema(
  schema: IRSchema,
  components: Record<string, IRSchema>
): IRSchema | undefined {
  const resolved =
    schema.kind === "ref" ? resolveRef(schema, components) : schema;
  return resolved.kind === "object" ? resolved : undefined;
}

function sortedStrings(values: Array<string>): Array<string> {
  return values.slice().toSorted((left, right) => left.localeCompare(right));
}

export function matchesExactProperties(
  schema: IRSchema,
  components: Record<string, IRSchema>,
  exactProperties: Array<string>
): boolean {
  const objectSchema = resolveObjectSchema(schema, components);
  if (objectSchema?.properties === undefined) {
    return false;
  }
  const keys = sortedStrings(Object.keys(objectSchema.properties));
  const expected = sortedStrings(exactProperties);
  return (
    keys.length === expected.length &&
    keys.every((key, index) => key === expected[index])
  );
}

export function matchesDeclarativeRule(
  schema: IRSchema,
  components: Record<string, IRSchema>,
  rule: Pick<
    DeclarativeKnownTypeRule,
    | "exactProperties"
    | "requireProperties"
    | "excludeProperties"
    | "maxPropertyCount"
  >
): boolean {
  const objectSchema = resolveObjectSchema(schema, components);
  if (objectSchema?.properties === undefined) {
    return false;
  }

  const keys = Object.keys(objectSchema.properties);
  if (
    rule.maxPropertyCount !== undefined &&
    keys.length > rule.maxPropertyCount
  ) {
    return false;
  }
  if (
    rule.exactProperties !== undefined &&
    !matchesExactProperties(schema, components, rule.exactProperties)
  ) {
    return false;
  }
  if (rule.requireProperties !== undefined) {
    for (const required of rule.requireProperties) {
      if (!(required in objectSchema.properties)) {
        return false;
      }
    }
  }
  if (rule.excludeProperties !== undefined) {
    for (const excluded of rule.excludeProperties) {
      if (excluded in objectSchema.properties) {
        return false;
      }
    }
  }
  return (
    rule.exactProperties !== undefined || rule.requireProperties !== undefined
  );
}
