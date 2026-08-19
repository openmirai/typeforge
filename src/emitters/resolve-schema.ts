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

export function refNameFromSchema(schema: IRSchema): string | undefined {
  if (schema.kind !== "ref" || schema.ref === undefined) {
    return undefined;
  }
  return schema.ref.split("/").pop();
}
