import type { JsonPrimitive } from "../json/types";

/** Intermediate representation of all parsed OpenAPI sources. */
export interface IR {
  /** Parsed API sources. */
  sources: Array<IRSource>;
}

/** Parsed paths and component schemas for one OpenAPI source. */
export interface IRSource {
  /** Source key from the Typeforge project configuration. */
  key: string;
  /** Parsed API paths. */
  paths: Array<IRPath>;
  /** Reusable schemas declared by the source specification. */
  components: { schemas: Record<string, IRSchema> };
}

/** An OpenAPI path and its supported operations. */
export interface IRPath {
  /** Path template as written in the OpenAPI document. */
  path: string;
  /** Filesystem-safe path used for generated output. */
  cleanPath: string;
  /** Supported HTTP operations on this path. */
  operations: Array<IROperation>;
}

/** A parsed OpenAPI operation. */
export interface IROperation {
  /** HTTP method for the operation. */
  method: HttpMethod;
  /** Explicit OpenAPI operation identifier, when provided. */
  operationId?: string;
  /** Short operation summary from the OpenAPI document. */
  summary?: string;
  /** Detailed operation description from the OpenAPI document. */
  description?: string;
  /** Whether the OpenAPI operation is deprecated. */
  deprecated?: boolean;
  /** Parameters substituted into the route path. */
  pathParams: Array<IRPathParam>;
  /** Parameters serialized into the query string. */
  queryParams: Array<IRQueryParam>;
  /** JSON request body, when the operation accepts one. */
  requestBody?: IRRequestBody;
  /** Declared operation responses. */
  responses: Array<IRResponse>;
}

/** HTTP methods supported by the Typeforge generator. */
export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/** Parsed path parameter metadata. */
export interface IRPathParam {
  /** Parameter name. */
  name: string;
  /** OpenAPI parameter description. */
  description?: string;
  /** Whether the parameter is deprecated. */
  deprecated?: boolean;
  /** Parameter value schema. */
  schema: IRSchema;
}

/** Parsed query parameter metadata. */
export interface IRQueryParam {
  /** Parameter name. */
  name: string;
  /** Whether callers must provide the parameter. */
  required: boolean;
  /** OpenAPI parameter description. */
  description?: string;
  /** Whether the parameter is deprecated. */
  deprecated?: boolean;
  /** Parameter value schema. */
  schema: IRSchema;
}

/** Parsed request-body metadata. */
export interface IRRequestBody {
  /** Whether callers must provide the request body. */
  required: boolean;
  /** OpenAPI request-body description. */
  description?: string;
  /** JSON request-body schema. */
  schema: IRSchema;
}

/** Parsed response metadata for one status code. */
export interface IRResponse {
  /** OpenAPI response status key, such as `"200"` or `"default"`. */
  statusCode: string;
  /** OpenAPI response description. */
  description?: string;
  /** JSON response schema, when one is declared. */
  schema?: IRSchema;
}

/** Typeforge's normalized representation of an OpenAPI schema. */
export interface IRSchema {
  /** Normalized schema construct used by the TypeScript renderer. */
  kind:
    | "object"
    | "array"
    | "string"
    | "number"
    | "boolean"
    | "null"
    | "unknown"
    | "ref"
    | "oneOf"
    | "anyOf"
    | "allOf";
  /** Referenced component name for `ref` schemas. */
  ref?: string;
  /** Element schema for arrays. */
  items?: IRSchema;
  /** Named fields for object schemas. */
  properties?: Record<string, IRSchemaProperty>;
  /** Required object-property names from the source schema. */
  required?: Array<string>;
  /** Allowed literal values. */
  enum?: Array<JsonPrimitive>;
  /** Schema for arbitrary object values, or whether they are allowed. */
  additionalProperties?: IRSchema | boolean;
  /** Exclusive union alternatives. */
  oneOf?: Array<IRSchema>;
  /** Non-exclusive union alternatives. */
  anyOf?: Array<IRSchema>;
  /** Intersected schema parts. */
  allOf?: Array<IRSchema>;
  /** OpenAPI scalar format, such as `uuid` or `date-time`. */
  format?: string;
  /** Whether the schema also accepts `null`. */
  nullable?: boolean;
  /** Human-readable OpenAPI schema description. */
  description?: string;
  /** Whether the OpenAPI schema is deprecated. */
  deprecated?: boolean;
  /** Extension that identifies the schema used for object map keys. */
  "x-map-key-ref"?: string;
}

/** A normalized object property and its requiredness. */
export interface IRSchemaProperty {
  /** Property value schema. */
  schema: IRSchema;
  /** Whether the containing object requires the property. */
  required: boolean;
}
