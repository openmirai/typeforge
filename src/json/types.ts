export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
  [key: string]: JsonValue;
}

export type JsonArray = Array<JsonValue>;

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export type QueryParamValue = string | number | boolean | null | undefined;

export type QueryParams = Record<string, QueryParamValue>;

export function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (typeof value === "object" && value !== null) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
}

export function isJsonObject(value: unknown): value is JsonObject {
  return (
    isJsonValue(value) &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function isJsonArray(value: unknown): value is JsonArray {
  return Array.isArray(value) && value.every(isJsonValue);
}

export function parseJson(text: string): JsonValue {
  const parsed: unknown = JSON.parse(text);
  if (!isJsonValue(parsed)) {
    throw new TypeError("JSON text did not parse to a valid JSON value");
  }
  return parsed;
}

export function readJsonObject(text: string): JsonObject {
  const parsed = parseJson(text);
  if (!isJsonObject(parsed)) {
    throw new TypeError("JSON text did not parse to a JSON object");
  }
  return parsed;
}

export function readJsonPrimitives(
  values: JsonValue | undefined
): Array<JsonPrimitive> {
  if (!isJsonArray(values)) {
    return [];
  }

  return values.filter(isJsonPrimitive);
}
