// IR types
export type {
  HttpMethod,
  IR,
  IROperation,
  IRPath,
  IRPathParam,
  IRQueryParam,
  IRRequestBody,
  IRResponse,
  IRSchema,
  IRSchemaProperty,
  IRSource,
} from "./parser/types";

// Parser
export { parseSchema, parseSpec } from "./parser/index";

// Loader
export { loadSpec, resolveSpecSource } from "./parser/loader";
export type { SpecSource } from "./parser/loader";

export type {
  JsonArray,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  QueryParams,
} from "./json/types";

export type { HTTPFetch, HTTPFetchConfig } from "./http/types";

export { defineSourceConfig } from "./config/define";
export type {
  GenerationMode,
  NamingStrategy,
  TypeforgeConfig,
  QueryExtendsConfig,
  SourceConfig,
} from "./config/types";

export { generateForSource, buildGenerateContext } from "./generate/index";
export type { GenerateOptions, GenerateResult } from "./generate/index";

export { initProject } from "./init/index";
export type { InitOptions, HttpClient, ProjectLayout } from "./init/index";

export {
  analyzeEnvelope,
  buildBaseResponseInterface,
  diffEnvelopeFields,
  parseUserBaseResponse,
} from "./envelope-guard/index";
export type {
  EnvelopeAnalysis,
  EnvelopeMode,
  EnvelopeShape,
} from "./envelope-guard/index";

export { RecursiveRefError } from "./emitters/recursive-ref-error";
export {
  loadKnownTypeRules,
  matchKnownType,
} from "./plugins/known-types/index";
export type {
  KnownTypeRule,
  DeclarativeKnownTypeRule,
} from "./plugins/known-types/index";
