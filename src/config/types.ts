export interface TypeforgeConfig {
  apiRoot?: string;
}

export type GenerationMode = "authoritative" | "merge";

export type NamingStrategy = "path" | "operationId";

export interface QueryExtendsConfig {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: string;
  paginationTypeName?: string;
  paginationImportPath?: string;
  sortTypeName?: string;
  sortImportPath?: string;
}

export interface SourceConfig {
  /**
   * Project-relative directory for generated API function files.
   * Defaults to `<apiRoot>/<source>/generated/functions`.
   */
  functionsDir?: string;
  /**
   * Project-relative directory for generated API type files.
   * Defaults to `<apiRoot>/<source>/generated/types`.
   */
  typesDir?: string;
  pathPrefix?: string;
  ignorePaths?: Array<string>;
  stripApiPrefix?: boolean;
  routeEnumName?: string;
  generationMode?: GenerationMode;
  naming?: NamingStrategy;
  maxRenderDepth?: number;
  resolveMapKeyRefs?: boolean;
  /**
   * Emit an envelope's `data` schema as the operation response type.
   * Enable this only when the project's HTTPFetch implementation already
   * unwraps response envelopes before returning its `{ data }` value.
   */
  unwrapResponseData?: boolean;
  queryExtends?: QueryExtendsConfig;
  /** When true, emit TanStack Query helpers for GET endpoints (requires query-scope.ts). */
  tanstackQuery?: boolean;
  /**
   * Explicit import base for generated function files pointing back to the
   * `generated/` directory.  When set, overrides both relative paths and
   * tsconfig alias auto-detection.
   *
   * Example: `"@mirai/utils/src/api/v2/generated"` produces imports like
   * `import ... from "@mirai/utils/src/api/v2/generated/runtime"`.
   */
  importBase?: string;
  /**
   * Path to the OpenAPI spec file, relative to the project root.
   * Used as the default spec source when no --spec flag or env var is provided.
   * Example: "../mirai-core-api/cmd/admin/docs/swagger.json"
   */
  spec?: string;
}

export const DEFAULT_API_ROOT = "src/api";
export const DEFAULT_ROUTE_ENUM_NAME = "RouteTargets";
export const DEFAULT_MAX_RENDER_DEPTH = 50;
