import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { readJsonObject } from "../json/types";
import type {
  TypeforgeConfig,
  QueryExtendsConfig,
  SourceConfig,
} from "./types";
import { DEFAULT_API_ROOT } from "./types";

function readOptionalJson(path: string): TypeforgeConfig {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const raw = readJsonObject(readFileSync(path, "utf8"));
    const config: TypeforgeConfig = {};
    if (typeof raw["apiRoot"] === "string") {
      config.apiRoot = raw["apiRoot"];
    }
    return config;
  } catch {
    return {};
  }
}

function readPackageConfig(path: string): TypeforgeConfig {
  if (!existsSync(path)) {
    return {};
  }

  try {
    const raw = readJsonObject(readFileSync(path, "utf8"));
    const typeforge = raw["typeforge"] ?? raw["openapiCodegen"];
    if (
      typeof typeforge !== "object" ||
      typeforge === null ||
      Array.isArray(typeforge)
    ) {
      return {};
    }

    const config: TypeforgeConfig = {};
    if (typeof typeforge["apiRoot"] === "string") {
      config.apiRoot = typeforge["apiRoot"];
    }
    return config;
  } catch {
    return {};
  }
}

function unwrapDefineSourceConfig(content: string): string {
  const match = content.match(
    /defineSourceConfig\s*(?:<[^>]*>)?\s*\(\s*\{([\s\S]*)\}\s*\)/
  );
  if (match?.[1] !== undefined) {
    return `{${match[1]}}`;
  }
  return content;
}

function parseSourceConfigContent(content: string): SourceConfig {
  const normalized = unwrapDefineSourceConfig(content);
  const config: SourceConfig = {};

  const pathPrefix = normalized.match(/pathPrefix:\s*["'`]([^"'`]+)["'`]/);
  if (pathPrefix?.[1] !== undefined) {
    config.pathPrefix = pathPrefix[1];
  }

  const functionsDir = normalized.match(/functionsDir:\s*["'`]([^"'`]+)["'`]/);
  if (functionsDir?.[1] !== undefined) {
    config.functionsDir = functionsDir[1];
  }

  const typesDir = normalized.match(/typesDir:\s*["'`]([^"'`]+)["'`]/);
  if (typesDir?.[1] !== undefined) {
    config.typesDir = typesDir[1];
  }

  const ignoreMatch = normalized.match(/ignorePaths:\s*\[([\s\S]*?)\]/);
  if (ignoreMatch?.[1] !== undefined) {
    const paths = [...ignoreMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)]
      .map((match) => match[1])
      .filter((path): path is string => path !== undefined);
    if (paths.length > 0) {
      config.ignorePaths = paths;
    }
  }

  if (/stripApiPrefix:\s*true/.test(normalized)) {
    config.stripApiPrefix = true;
  }

  const routeEnumName = normalized.match(
    /routeEnumName:\s*["'`]([^"'`]+)["'`]/
  );
  if (routeEnumName?.[1] !== undefined) {
    config.routeEnumName = routeEnumName[1];
  }

  const generationMode = normalized.match(
    /generationMode:\s*["'`](authoritative|merge)["'`]/
  );
  if (
    generationMode?.[1] === "authoritative" ||
    generationMode?.[1] === "merge"
  ) {
    config.generationMode = generationMode[1];
  }

  const naming = normalized.match(/naming:\s*["'`](path|operationId)["'`]/);
  if (naming?.[1] === "path" || naming?.[1] === "operationId") {
    config.naming = naming[1];
  }

  if (/resolveMapKeyRefs:\s*false/.test(normalized)) {
    config.resolveMapKeyRefs = false;
  }

  if (/unwrapResponseData:\s*true/.test(normalized)) {
    config.unwrapResponseData = true;
  }

  if (/tanstackQuery:\s*true/.test(normalized)) {
    config.tanstackQuery = true;
  }

  const importBase = normalized.match(/importBase:\s*["'`]([^"'`]+)["'`]/);
  if (importBase?.[1] !== undefined) {
    config.importBase = importBase[1];
  }

  const maxRenderDepth = normalized.match(/maxRenderDepth:\s*(\d+)/)?.[1];
  if (maxRenderDepth !== undefined) {
    config.maxRenderDepth = Number.parseInt(maxRenderDepth, 10);
  }

  const queryExtends = parseQueryExtends(normalized);
  if (queryExtends !== undefined) {
    config.queryExtends = queryExtends;
  }

  const spec = normalized.match(/spec:\s*["'`]([^"'`]+)["'`]/);
  if (spec?.[1] !== undefined) {
    config.spec = spec[1];
  }

  return config;
}

function parseQueryExtends(content: string): QueryExtendsConfig | undefined {
  const block = content.match(/queryExtends:\s*\{([\s\S]*?)\}/)?.[1];
  if (block === undefined) {
    return undefined;
  }

  const config: QueryExtendsConfig = {};
  const read = (key: string): string | undefined =>
    block.match(new RegExp(`${key}:\\s*["'\`]([^"'\`]+)["'\`]`))?.[1];

  const page = read("page");
  const limit = read("limit");
  const sortBy = read("sortBy");
  const sortOrder = read("sortOrder");
  const paginationTypeName = read("paginationTypeName");
  const paginationImportPath = read("paginationImportPath");
  const sortTypeName = read("sortTypeName");
  const sortImportPath = read("sortImportPath");

  if (page !== undefined) {
    config.page = page;
  }
  if (limit !== undefined) {
    config.limit = limit;
  }
  if (sortBy !== undefined) {
    config.sortBy = sortBy;
  }
  if (sortOrder !== undefined) {
    config.sortOrder = sortOrder;
  }
  if (paginationTypeName !== undefined) {
    config.paginationTypeName = paginationTypeName;
  }
  if (paginationImportPath !== undefined) {
    config.paginationImportPath = paginationImportPath;
  }
  if (sortTypeName !== undefined) {
    config.sortTypeName = sortTypeName;
  }
  if (sortImportPath !== undefined) {
    config.sortImportPath = sortImportPath;
  }

  return Object.keys(config).length > 0 ? config : undefined;
}

export function loadProjectConfig(cwd: string): TypeforgeConfig {
  const fromJson = readOptionalJson(resolve(cwd, "typeforge.json"));
  const fromLegacyJson = readOptionalJson(resolve(cwd, "openapi-codegen.json"));
  const fromPackage = readPackageConfig(resolve(cwd, "package.json"));

  return {
    apiRoot:
      fromJson.apiRoot ??
      fromLegacyJson.apiRoot ??
      fromPackage.apiRoot ??
      DEFAULT_API_ROOT,
  };
}

export function loadSourceConfig(
  cwd: string,
  apiRoot: string,
  sourceKey: string
): SourceConfig {
  const sourcePath = resolve(cwd, apiRoot, sourceKey, "source.ts");
  if (!existsSync(sourcePath)) {
    return {};
  }

  return parseSourceConfigContent(readFileSync(sourcePath, "utf8"));
}

export function readModelsFile(
  cwd: string,
  apiRoot: string
): string | undefined {
  const modelsPath = resolve(cwd, apiRoot, "models.ts");
  if (!existsSync(modelsPath)) {
    return undefined;
  }
  return readFileSync(modelsPath, "utf8");
}

export function hasQueryScopeFile(cwd: string, apiRoot: string): boolean {
  return existsSync(resolve(cwd, apiRoot, "query-scope.ts"));
}

export function detectHttpMode(
  cwd: string,
  apiRoot: string
): "singleton" | "injected" {
  const httpPath = resolve(cwd, apiRoot, "http.ts");
  if (!existsSync(httpPath)) {
    return "injected";
  }

  const content = readFileSync(httpPath, "utf8");
  if (/export\s+(const|function)\s+httpFetch\b/.test(content)) {
    return "singleton";
  }
  if (/export\s*\{[^}]*\bhttpFetch\b/.test(content)) {
    return "singleton";
  }
  return "injected";
}

export function listSourceKeys(cwd: string, apiRoot: string): Array<string> {
  const apiRootPath = resolve(cwd, apiRoot);
  if (!existsSync(apiRootPath)) {
    return [];
  }

  return readdirSync(apiRootPath).filter((entry) => {
    const entryPath = join(apiRootPath, entry);
    if (!statSync(entryPath).isDirectory()) {
      return false;
    }
    return existsSync(join(entryPath, "source.ts"));
  });
}
