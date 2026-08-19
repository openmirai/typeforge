import type { IRPath, IRSchema } from "../parser/types";

export function renderPathParamTypeFromSchema(schema: IRSchema): string {
  if (schema.enum !== undefined && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (schema.kind === "number") {
    return "number";
  }
  if (schema.kind === "boolean") {
    return "boolean";
  }
  return "string";
}

export function resolvePathParamSchemas(
  pathItem: IRPath
): Map<string, IRSchema> {
  const schemas = new Map<string, IRSchema>();
  for (const operation of pathItem.operations) {
    for (const param of operation.pathParams) {
      if (!schemas.has(param.name)) {
        schemas.set(param.name, param.schema);
      }
    }
  }
  return schemas;
}

export function renderPathParamType(
  schemas: Map<string, IRSchema>,
  param: string
): string {
  const schema = schemas.get(param);
  if (schema === undefined) {
    return "string";
  }
  return renderPathParamTypeFromSchema(schema);
}
