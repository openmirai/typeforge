import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { loadProjectConfig } from "../config/load";
import type { OpenApiCodegenConfig } from "../config/types";
import { DEFAULT_API_ROOT } from "../config/types";

export type HttpClient = "axios" | "fetch" | "custom";
export type ProjectLayout = "monolith" | "packages";

export interface InitOptions {
  cwd?: string;
  sourceKey: string;
  client: HttpClient;
  layout?: ProjectLayout;
}

const AXIOS_HTTP_TEMPLATE = `import axiosBase from "axios";
import { createAxiosAdapter } from "@openmirai/openapi-codegen/adapters/axios";

const axios = axiosBase.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

axios.interceptors.request.use(
  async (config) => {
    // Add auth headers, tracing, or Content-Type defaults here.
    return config;
  },
  (error) => Promise.reject(error),
);

axios.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
);

export const httpFetch = createAxiosAdapter(axios);
export { axios };
export type { HTTPFetch, HTTPFetchConfig } from "@openmirai/openapi-codegen/adapters/axios";
`;

const FETCH_HTTP_TEMPLATE = `import { createFetchAdapter } from "@openmirai/openapi-codegen/adapters/fetch";

export const httpFetch = createFetchAdapter({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

export type { HTTPFetch, HTTPFetchConfig } from "@openmirai/openapi-codegen/adapters/fetch";
`;

const CUSTOM_HTTP_TEMPLATE = `import type { HTTPFetch, HTTPFetchConfig } from "@openmirai/openapi-codegen/http";

export type { HTTPFetch, HTTPFetchConfig };

export const httpFetch: HTTPFetch = {
  delete: async <TResponse>(
    _route: string,
    _config?: HTTPFetchConfig
  ): Promise<{ data: TResponse }> => {
    throw new Error("Implement httpFetch.delete");
  },
  get: async <TResponse>(
    _route: string,
    _config?: HTTPFetchConfig
  ): Promise<{ data: TResponse }> => {
    throw new Error("Implement httpFetch.get");
  },
  patch: async <TResponse, TBody = unknown>(
    _route: string,
    _body: TBody,
    _config?: HTTPFetchConfig
  ): Promise<{ data: TResponse }> => {
    throw new Error("Implement httpFetch.patch");
  },
  post: async <TResponse, TBody = unknown>(
    _route: string,
    _body: TBody,
    _config?: HTTPFetchConfig
  ): Promise<{ data: TResponse }> => {
    throw new Error("Implement httpFetch.post");
  },
  put: async <TResponse, TBody = unknown>(
    _route: string,
    _body: TBody,
    _config?: HTTPFetchConfig
  ): Promise<{ data: TResponse }> => {
    throw new Error("Implement httpFetch.put");
  },
};
`;

const SOURCE_TEMPLATE = `export default {
  // Path to the OpenAPI spec file, relative to the project root.
  // Set this so \`openapi-codegen generate --source <key>\` (or --all) works
  // without a per-invocation --spec flag.
  // spec: "../path/to/swagger.json",
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  routeEnumName: "RouteTargets",
  generationMode: "authoritative" as const,
  naming: "path" as const,
  ignorePaths: [],
  maxRenderDepth: 50,
  resolveMapKeyRefs: true,
  queryExtends: {
    page: "page",
    limit: "limit",
    sortBy: "sortBy",
    sortOrder: "sortOrder",
    paginationTypeName: "OffsetLimitQuery",
    paginationImportPath: "./pagination",
    sortTypeName: "SortParams",
    sortImportPath: "./pagination",
  },
};
`;

const KNOWN_TYPES_TEMPLATE = `/** Map OpenAPI object shapes to your own TypeScript types by property pattern. */
export const knownTypes = [
  // {
  //   name: "BlobAsset",
  //   typeName: "BlobAsset",
  //   importPath: "./blob/types",
  //   exactProperties: ["id", "url", "file"],
  // },
  // {
  //   name: "TiptapNode",
  //   typeName: "TiptapNode",
  //   importPath: "./tiptap/types",
  //   requireProperties: ["type"],
  //   excludeProperties: ["courseCount"],
  // },
];
`;

function defaultApiRoot(layout: ProjectLayout): string {
  return layout === "packages" ? "packages/utils/src/api" : "src/api";
}

function writeIfMissing(path: string, content: string): "created" | "skipped" {
  if (existsSync(path)) {
    return "skipped";
  }
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf8");
  return "created";
}

export function initProject(options: InitOptions): {
  created: Array<string>;
  skipped: Array<string>;
} {
  const cwd = options.cwd ?? process.cwd();
  const layout = options.layout ?? "monolith";
  const configPath = resolve(cwd, "openapi-codegen.json");
  const projectConfig = loadProjectConfig(cwd);
  const apiRoot = existsSync(configPath)
    ? (projectConfig.apiRoot ?? DEFAULT_API_ROOT)
    : defaultApiRoot(layout);
  const apiRootPath = resolve(cwd, apiRoot);
  const sourceDir = join(apiRootPath, options.sourceKey);

  let httpTemplate = CUSTOM_HTTP_TEMPLATE;
  if (options.client === "axios") {
    httpTemplate = AXIOS_HTTP_TEMPLATE;
  } else if (options.client === "fetch") {
    httpTemplate = FETCH_HTTP_TEMPLATE;
  }

  const created: Array<string> = [];
  const skipped: Array<string> = [];

  const httpPath = join(apiRootPath, "http.ts");
  const httpResult = writeIfMissing(httpPath, httpTemplate);
  if (httpResult === "created") {
    created.push(httpPath);
  } else {
    skipped.push(httpPath);
  }

  const sourcePath = join(sourceDir, "source.ts");
  const sourceResult = writeIfMissing(sourcePath, SOURCE_TEMPLATE);
  if (sourceResult === "created") {
    created.push(sourcePath);
  } else {
    skipped.push(sourcePath);
  }

  const knownTypesPath = join(apiRootPath, "known-types.ts");
  const knownTypesResult = writeIfMissing(knownTypesPath, KNOWN_TYPES_TEMPLATE);
  if (knownTypesResult === "created") {
    created.push(knownTypesPath);
  } else {
    skipped.push(knownTypesPath);
  }

  const configWritePath = resolve(cwd, "openapi-codegen.json");
  if (!existsSync(configWritePath)) {
    const config: OpenApiCodegenConfig = { apiRoot };
    writeFileSync(
      configWritePath,
      `${JSON.stringify(config, null, 2)}\n`,
      "utf8"
    );
    created.push(configWritePath);
  }

  mkdirSync(join(sourceDir, "generated"), { recursive: true });

  return { created, skipped };
}
