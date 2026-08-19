import type {
  HttpMethod,
  IROperation,
  IRPath,
  IRPathParam,
  IRQueryParam,
  IRRequestBody,
  IRResponse,
  IRSchema,
  IRSchemaProperty,
  IRSource,
} from "./types";
import type { JsonObject, JsonValue } from "../json/types";
import { isJsonArray, isJsonObject, readJsonPrimitives } from "../json/types";

const HTTP_METHODS: Array<HttpMethod> = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
];

function readObjectArray(value: JsonValue | undefined): Array<JsonObject> {
  if (!isJsonArray(value)) {
    return [];
  }

  return value.filter(isJsonObject);
}

function extractRefName(ref: string): string {
  const parts = ref.split("/");
  return parts.at(-1) ?? ref;
}

function toCleanPath(pathStr: string): string {
  return pathStr.replace(/^\//, "").replace(/\{([^}]+)\}/g, "[$1]");
}

// ---------------------------------------------------------------------------
// Schema parsing
// ---------------------------------------------------------------------------

export function parseSchema(raw: JsonValue): IRSchema {
  if (!isJsonObject(raw)) {
    return { kind: "unknown" };
  }

  // $ref — preserve as named reference; no inline resolution avoids circular-ref loops
  if (typeof raw["$ref"] === "string") {
    return { kind: "ref", ref: extractRefName(raw["$ref"]) };
  }

  // Composition keywords (check before type to match specs that omit type alongside these)
  if (isJsonArray(raw["oneOf"]) && raw["oneOf"].length > 0) {
    return {
      kind: "oneOf",
      oneOf: raw["oneOf"].map(parseSchema),
    };
  }
  if (isJsonArray(raw["anyOf"]) && raw["anyOf"].length > 0) {
    return {
      anyOf: raw["anyOf"].map(parseSchema),
      kind: "anyOf",
    };
  }
  if (isJsonArray(raw["allOf"]) && raw["allOf"].length > 0) {
    return {
      allOf: raw["allOf"].map(parseSchema),
      kind: "allOf",
    };
  }

  const rawType = typeof raw["type"] === "string" ? raw["type"] : undefined,
    nullable = raw["nullable"] === true;

  // Array
  if (rawType === "array") {
    const schema: IRSchema = { kind: "array" };
    if (raw["items"] !== undefined) {
      schema.items = parseSchema(raw["items"]);
    }
    if (nullable) {
      schema.nullable = true;
    }
    return schema;
  }

  // Object — explicit type or inferred from presence of properties/additionalProperties
  const looksLikeObject =
    rawType === "object" ||
    (rawType === undefined &&
      (isJsonObject(raw["properties"]) ||
        raw["additionalProperties"] !== undefined));

  if (looksLikeObject) {
    return buildObjectSchema(raw, nullable);
  }

  // Numerics
  if (rawType === "integer" || rawType === "number") {
    const schema: IRSchema = { kind: "number" };
    if (typeof raw["format"] === "string") {
      schema.format = raw["format"];
    }
    if (nullable) {
      schema.nullable = true;
    }
    if (Array.isArray(raw["enum"])) {
      schema.enum = readJsonPrimitives(raw["enum"]);
    }
    if (typeof raw["x-map-key-ref"] === "string") {
      schema["x-map-key-ref"] = raw["x-map-key-ref"];
    }
    return schema;
  }

  if (rawType === "string") {
    const schema: IRSchema = { kind: "string" };
    if (typeof raw["format"] === "string") {
      schema.format = raw["format"];
    }
    if (nullable) {
      schema.nullable = true;
    }
    if (Array.isArray(raw["enum"])) {
      schema.enum = readJsonPrimitives(raw["enum"]);
    }
    if (typeof raw["x-map-key-ref"] === "string") {
      schema["x-map-key-ref"] = raw["x-map-key-ref"];
    }
    return schema;
  }

  if (rawType === "boolean") {
    const schema: IRSchema = { kind: "boolean" };
    if (nullable) {
      schema.nullable = true;
    }
    return schema;
  }

  if (rawType === "null") {
    return { kind: "null" };
  }

  return { kind: "unknown" };
}

function buildObjectSchema(raw: JsonObject, nullable: boolean): IRSchema {
  const schema: IRSchema = { kind: "object" };
  if (nullable) {
    schema.nullable = true;
  }

  if (isJsonObject(raw["properties"])) {
    const requiredList = isJsonArray(raw["required"])
        ? raw["required"].filter(
            (entry): entry is string => typeof entry === "string"
          )
        : [],
      properties: Record<string, IRSchemaProperty> = {};
    for (const [key, propRaw] of Object.entries(raw["properties"])) {
      properties[key] = {
        required: requiredList.includes(key),
        schema: parseSchema(propRaw),
      };
    }
    schema.properties = properties;
    if (requiredList.length > 0) {
      schema.required = requiredList;
    }
  }

  if (raw["additionalProperties"] !== undefined) {
    if (typeof raw["additionalProperties"] === "boolean") {
      schema.additionalProperties = raw["additionalProperties"];
    } else {
      schema.additionalProperties = parseSchema(raw["additionalProperties"]);
    }
  }

  if (typeof raw["x-map-key-ref"] === "string") {
    schema["x-map-key-ref"] = raw["x-map-key-ref"];
  }

  return schema;
}

// ---------------------------------------------------------------------------
// Swagger 2 helpers
// ---------------------------------------------------------------------------

/**
 * Convert a Swagger 2 parameter's inline type attributes to an IRSchema.
 * Swagger 2 parameters carry `type`, `format`, `enum` directly (no `schema` sub-object
 * unless `in: body`).
 */
function swaggerParamToSchema(param: JsonObject): IRSchema {
  if (isJsonObject(param["schema"])) {
    return parseSchema(param["schema"]);
  }

  const paramSchema: JsonObject = {};
  if (param["enum"] !== undefined) {
    paramSchema.enum = param["enum"];
  }
  if (typeof param["format"] === "string") {
    paramSchema.format = param["format"];
  }
  if (typeof param["type"] === "string") {
    paramSchema.type = param["type"];
  }

  return parseSchema(paramSchema);
}

function parseSwagger2(raw: JsonObject, opts: ParseOpts): IRSource {
  const schemas: Record<string, IRSchema> = {},
    definitions = isJsonObject(raw["definitions"]) ? raw["definitions"] : {};
  for (const [name, def] of Object.entries(definitions)) {
    schemas[name] = parseSchema(def);
  }

  const paths = parsePaths(raw, "swagger2", opts);

  return { components: { schemas }, key: "", paths };
}

// ---------------------------------------------------------------------------
// OpenAPI 3 helpers
// ---------------------------------------------------------------------------

function parseOpenAPI3(raw: JsonObject, opts: ParseOpts): IRSource {
  const schemas: Record<string, IRSchema> = {},
    components = isJsonObject(raw["components"]) ? raw["components"] : {},
    compSchemas = isJsonObject(components["schemas"])
      ? components["schemas"]
      : {};
  for (const [name, def] of Object.entries(compSchemas)) {
    schemas[name] = parseSchema(def);
  }

  const paths = parsePaths(raw, "openapi3", opts);

  return { components: { schemas }, key: "", paths };
}

// ---------------------------------------------------------------------------
// Shared path/operation parsing
// ---------------------------------------------------------------------------

type SpecVersion = "swagger2" | "openapi3";

interface ParseOpts {
  pathPrefix?: string;
  ignorePaths?: Array<string>;
}

function parsePaths(
  raw: JsonObject,
  version: SpecVersion,
  opts: ParseOpts
): Array<IRPath> {
  const result: Array<IRPath> = [],
    rawPaths = raw["paths"];
  if (!isJsonObject(rawPaths)) {
    return result;
  }

  for (const [pathStr, pathItemRaw] of Object.entries(rawPaths)) {
    if (opts.pathPrefix !== undefined && !pathStr.startsWith(opts.pathPrefix)) {
      continue;
    }
    if (opts.ignorePaths?.includes(pathStr)) {
      continue;
    }
    if (!isJsonObject(pathItemRaw)) {
      continue;
    }

    const pathLevelParams = readObjectArray(pathItemRaw["parameters"]),
      operations: Array<IROperation> = [];

    for (const method of HTTP_METHODS) {
      const opRaw = pathItemRaw[method];
      if (!isJsonObject(opRaw)) {
        continue;
      }

      const op = parseOperation(method, opRaw, pathLevelParams, version);
      operations.push(op);
    }

    if (operations.length > 0) {
      result.push({
        cleanPath: toCleanPath(pathStr),
        operations,
        path: pathStr,
      });
    }
  }

  return result;
}

function mergeParams(
  pathLevel: Array<JsonObject>,
  opLevel: Array<JsonObject>
): Array<JsonObject> {
  const map = new Map<string, JsonObject>();
  for (const p of pathLevel) {
    if (typeof p["name"] === "string") {
      map.set(p["name"], p);
    }
  }
  for (const p of opLevel) {
    if (typeof p["name"] === "string") {
      map.set(p["name"], p);
    }
  }
  return [...map.values()];
}

function resolveOpenAPI3ParamSchema(param: JsonObject): IRSchema {
  if (isJsonObject(param["schema"])) {
    return parseSchema(param["schema"]);
  }
  return { kind: "unknown" };
}

function resolveParamSchema(param: JsonObject, version: SpecVersion): IRSchema {
  if (version === "openapi3") {
    return resolveOpenAPI3ParamSchema(param);
  }
  return swaggerParamToSchema(param);
}

function parseOperation(
  method: HttpMethod,
  opRaw: JsonObject,
  pathLevelParams: Array<JsonObject>,
  version: SpecVersion
): IROperation {
  const opParams = readObjectArray(opRaw["parameters"]),
    params = mergeParams(pathLevelParams, opParams),
    pathParams: Array<IRPathParam> = [],
    queryParams: Array<IRQueryParam> = [];

  for (const param of params) {
    if (typeof param["name"] !== "string") {
      continue;
    }

    if (param["in"] === "path") {
      pathParams.push({
        name: param["name"],
        schema: resolveParamSchema(param, version),
      });
    } else if (param["in"] === "query") {
      queryParams.push({
        name: param["name"],
        required: param["required"] === true,
        schema: resolveParamSchema(param, version),
      });
    }
  }

  const requestBody =
      version === "swagger2"
        ? parseSwagger2Body(params)
        : parseOpenAPI3Body(opRaw),
    responses = parseResponses(opRaw, version),
    operation: IROperation = { method, pathParams, queryParams, responses };
  if (typeof opRaw["operationId"] === "string") {
    operation.operationId = opRaw["operationId"];
  }
  if (requestBody !== undefined) {
    operation.requestBody = requestBody;
  }

  return operation;
}

function parseSwagger2Body(
  params: Array<JsonObject>
): IRRequestBody | undefined {
  const bodyParam = params.find((p) => p["in"] === "body");
  if (bodyParam === undefined) {
    return undefined;
  }

  const schema = isJsonObject(bodyParam["schema"])
    ? parseSchema(bodyParam["schema"])
    : { kind: "unknown" as const };

  return { required: bodyParam["required"] === true, schema };
}

function parseOpenAPI3Body(opRaw: JsonObject): IRRequestBody | undefined {
  if (!isJsonObject(opRaw["requestBody"])) {
    return undefined;
  }
  const reqBodyRaw = opRaw["requestBody"],
    content = isJsonObject(reqBodyRaw["content"]) ? reqBodyRaw["content"] : {},
    jsonContent = isJsonObject(content["application/json"])
      ? content["application/json"]
      : {},
    schema = isJsonObject(jsonContent["schema"])
      ? parseSchema(jsonContent["schema"])
      : { kind: "unknown" as const };

  return { required: reqBodyRaw["required"] === true, schema };
}

function parseResponses(
  opRaw: JsonObject,
  version: SpecVersion
): Array<IRResponse> {
  const result: Array<IRResponse> = [];
  if (!isJsonObject(opRaw["responses"])) {
    return result;
  }

  for (const [statusCode, respRaw] of Object.entries(opRaw["responses"])) {
    if (!isJsonObject(respRaw)) {
      result.push({ statusCode });
      continue;
    }

    const irResp: IRResponse = { statusCode };

    if (version === "swagger2") {
      if (isJsonObject(respRaw["schema"])) {
        irResp.schema = parseSchema(respRaw["schema"]);
      }
    } else {
      const content = isJsonObject(respRaw["content"])
          ? respRaw["content"]
          : {},
        jsonContent = isJsonObject(content["application/json"])
          ? content["application/json"]
          : {};
      if (isJsonObject(jsonContent["schema"])) {
        irResp.schema = parseSchema(jsonContent["schema"]);
      }
    }

    result.push(irResp);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseSpec(
  raw: JsonValue,
  opts: { pathPrefix?: string; ignorePaths?: Array<string> }
): IRSource {
  if (!isJsonObject(raw)) {
    return { components: { schemas: {} }, key: "", paths: [] };
  }

  const parseOpts: ParseOpts = {};
  if (opts.pathPrefix !== undefined) {
    parseOpts.pathPrefix = opts.pathPrefix;
  }
  if (opts.ignorePaths !== undefined) {
    parseOpts.ignorePaths = opts.ignorePaths;
  }

  if (raw["swagger"] === "2.0") {
    return parseSwagger2(raw, parseOpts);
  }

  if (typeof raw["openapi"] === "string" && raw["openapi"].startsWith("3.")) {
    return parseOpenAPI3(raw, parseOpts);
  }

  return { components: { schemas: {} }, key: "", paths: [] };
}
