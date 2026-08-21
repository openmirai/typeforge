import type { IRSchema } from "../parser/types";

export function resolveRef(
  schema: IRSchema,
  components: Record<string, IRSchema>
): IRSchema {
  if (schema.kind !== "ref" || schema.ref === undefined) {
    return schema;
  }

  const refName = schema.ref.split("/").pop();
  if (refName === undefined || components[refName] === undefined) {
    return { kind: "unknown" };
  }

  return components[refName];
}

/**
 * Resolve an object schema through component references and `allOf` composition.
 * The returned object is a new flattened view; component schemas are never mutated.
 */
export function resolveObjectSchema(
  schema: IRSchema,
  components: Record<string, IRSchema>,
  visitedRefs: ReadonlySet<string> = new Set()
): IRSchema | undefined {
  if (schema.kind === "object") {
    return schema;
  }

  if (schema.kind === "ref") {
    const refName = refNameFromSchema(schema);
    if (refName === undefined || visitedRefs.has(refName)) {
      return undefined;
    }
    const resolved = components[refName];
    if (resolved === undefined) {
      return undefined;
    }
    return resolveObjectSchema(
      resolved,
      components,
      new Set([...visitedRefs, refName])
    );
  }

  if (schema.kind !== "allOf" || schema.allOf === undefined) {
    return undefined;
  }

  const properties: NonNullable<IRSchema["properties"]> = {};
  const required = new Set<string>();
  for (const member of schema.allOf) {
    const resolved = resolveObjectSchema(member, components, visitedRefs);
    if (resolved?.properties === undefined) {
      return undefined;
    }
    for (const [name, property] of Object.entries(resolved.properties)) {
      const existing = properties[name];
      properties[name] =
        existing === undefined
          ? { ...property }
          : {
              required: existing.required || property.required,
              schema:
                JSON.stringify(existing.schema) ===
                JSON.stringify(property.schema)
                  ? existing.schema
                  : {
                      allOf: [existing.schema, property.schema],
                      kind: "allOf",
                    },
            };
      if (property.required) {
        required.add(name);
      }
    }
  }

  return {
    kind: "object",
    properties,
    required: [...required],
  };
}

export function refNameFromSchema(schema: IRSchema): string | undefined {
  if (schema.kind !== "ref" || schema.ref === undefined) {
    return undefined;
  }
  return schema.ref.split("/").pop();
}
