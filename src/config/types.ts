export interface OpenApiCodegenConfig {
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
  pathPrefix?: string;
  ignorePaths?: Array<string>;
  stripApiPrefix?: boolean;
  routeEnumName?: string;
  generationMode?: GenerationMode;
  naming?: NamingStrategy;
  maxRenderDepth?: number;
  resolveMapKeyRefs?: boolean;
  queryExtends?: QueryExtendsConfig;
  /** When true, emit TanStack Query helpers for GET endpoints (requires query-scope.ts). */
  tanstackQuery?: boolean;
}

export const DEFAULT_API_ROOT = "src/api";
export const DEFAULT_ROUTE_ENUM_NAME = "RouteTargets";
export const DEFAULT_MAX_RENDER_DEPTH = 50;
