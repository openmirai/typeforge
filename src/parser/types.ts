import type { JsonPrimitive } from "../json/types";

export interface IR {
  sources: Array<IRSource>;
}

export interface IRSource {
  key: string;
  paths: Array<IRPath>;
  components: { schemas: Record<string, IRSchema> };
}

export interface IRPath {
  path: string;
  cleanPath: string;
  operations: Array<IROperation>;
}

export interface IROperation {
  method: HttpMethod;
  operationId?: string;
  pathParams: Array<IRPathParam>;
  queryParams: Array<IRQueryParam>;
  requestBody?: IRRequestBody;
  responses: Array<IRResponse>;
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface IRPathParam {
  name: string;
  schema: IRSchema;
}

export interface IRQueryParam {
  name: string;
  required: boolean;
  schema: IRSchema;
}

export interface IRRequestBody {
  required: boolean;
  schema: IRSchema;
}

export interface IRResponse {
  statusCode: string;
  schema?: IRSchema;
}

export interface IRSchema {
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
  ref?: string;
  items?: IRSchema;
  properties?: Record<string, IRSchemaProperty>;
  required?: Array<string>;
  enum?: Array<JsonPrimitive>;
  additionalProperties?: IRSchema | boolean;
  oneOf?: Array<IRSchema>;
  anyOf?: Array<IRSchema>;
  allOf?: Array<IRSchema>;
  format?: string;
  nullable?: boolean;
  "x-map-key-ref"?: string;
}

export interface IRSchemaProperty {
  schema: IRSchema;
  required: boolean;
}
