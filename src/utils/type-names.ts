import type { HttpMethod, IROperation, IRSchema } from "../parser/types";
import { isSuccessStatusCode } from "./naming";

export function getFunctionTypeName(
  cleanPath: string,
  method: HttpMethod
): string {
  const parts = cleanPath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[{[\]}/]/g, "")
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
    )
    .join("");

  return `${method.toUpperCase()}${parts}`;
}

export function hasMeaningfulRequestBody(operation: IROperation): boolean {
  const schema = operation.requestBody?.schema;
  if (schema === undefined) {
    return false;
  }
  return !isEmptySchema(schema);
}

function isEmptySchema(schema: IRSchema): boolean {
  if (schema.kind === "unknown") {
    return true;
  }
  if (schema.kind === "object" && schema.properties !== undefined) {
    return Object.keys(schema.properties).length === 0;
  }
  return false;
}

export function getSuccessResponseSchema(
  operation: IROperation
): IRSchema | undefined {
  const success = operation.responses.find(
    (response) =>
      isSuccessStatusCode(response.statusCode) && response.schema !== undefined
  );
  return success?.schema;
}
