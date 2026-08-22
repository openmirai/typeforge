/** Project-wide Typeforge settings loaded from `typeforge.json` or package.json. */
export interface TypeforgeConfig {
  /**
   * Root directory containing HTTP adapters and named API sources.
   * @defaultValue `"src/api"`
   */
  apiRoot?: string;
}

/** Controls whether generated routes replace or preserve existing route entries. */
export type GenerationMode = "authoritative" | "merge";

/** Selects whether generated function names come from paths or OpenAPI operation IDs. */
export type NamingStrategy = "path" | "operationId";

/** Maps API query-parameter names to shared pagination and sorting types. */
export interface QueryExtendsConfig {
  /**
   * Name of the page-number query parameter.
   * @defaultValue `"page"`
   */
  page?: string;
  /**
   * Name of the page-size query parameter.
   * @defaultValue `"limit"`
   */
  limit?: string;
  /**
   * Name of the sort-field query parameter.
   * @defaultValue `"sortBy"`
   */
  sortBy?: string;
  /**
   * Name of the sort-direction query parameter.
   * @defaultValue `"sortOrder"`
   */
  sortOrder?: string;
  /** Shared type that replaces matching page and limit properties. */
  paginationTypeName?: string;
  /** Module specifier from which the shared pagination type is imported. */
  paginationImportPath?: string;
  /** Generic shared type that replaces matching sort properties. */
  sortTypeName?: string;
  /** Module specifier from which the shared sort type is imported. */
  sortImportPath?: string;
}

/** Generation settings exported by an API source's `source.ts` file. */
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
  /** Only generate operations whose paths start with this prefix. */
  pathPrefix?: string;
  /** Exact OpenAPI paths to exclude from generation. */
  ignorePaths?: Array<string>;
  /** Remove the leading `/api` segment from generated route names and values. */
  stripApiPrefix?: boolean;
  /**
   * Name of the generated route-target enum.
   * @defaultValue `"RouteTargets"`
   */
  routeEnumName?: string;
  /** Whether route generation replaces the file or retains extra existing entries. */
  generationMode?: GenerationMode;
  /**
   * Strategy used to derive generated caller function names.
   * @defaultValue `"path"`
   */
  naming?: NamingStrategy;
  /**
   * Maximum schema expansion depth before recursive generation fails.
   * @defaultValue `50`
   */
  maxRenderDepth?: number;
  /**
   * Resolve `x-map-key-ref` extensions into typed `Record` keys.
   * @defaultValue `true`
   */
  resolveMapKeyRefs?: boolean;
  /**
   * Emit an envelope's `data` schema as the operation response type.
   * Enable this only when the project's HTTPFetch implementation already
   * unwraps response envelopes before returning its `{ data }` value.
   */
  unwrapResponseData?: boolean;
  /** Replace conventional pagination and sorting properties with shared local types. */
  queryExtends?: QueryExtendsConfig;
  /** Emit TanStack Query helpers for GET endpoints when `query-scope.ts` exists. */
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

/** Default project-relative API root. */
export const DEFAULT_API_ROOT = "src/api";
/** Default name for the generated route-target enum. */
export const DEFAULT_ROUTE_ENUM_NAME = "RouteTargets";
/** Default maximum depth for expanding referenced schemas. */
export const DEFAULT_MAX_RENDER_DEPTH = 50;
