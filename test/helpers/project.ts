import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_SOURCE_CONFIG } from "./synthetic-api";

export interface MonolithProjectOptions {
  root: string;
  sourceKey: string;
  specContent: string;
  apiRoot?: string;
  sourceConfig?: string;
  httpContent?: string;
  modelsContent?: string;
  knownTypesContent?: string;
  queryScopeContent?: string;
}

const DEFAULT_HTTP_SINGLETON = `export const httpFetch = {
  delete: async () => ({ data: undefined }),
  get: async () => ({ data: undefined }),
  patch: async () => ({ data: undefined }),
  post: async () => ({ data: undefined }),
  put: async () => ({ data: undefined }),
} as const;
`;

export function createMonolithProject(options: MonolithProjectOptions): {
  apiRoot: string;
  sourceDir: string;
  generatedDir: string;
} {
  const apiRoot = options.apiRoot ?? "src/api";
  const sourceDir = join(options.root, apiRoot, options.sourceKey);
  const generatedDir = join(sourceDir, "generated");

  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(join(options.root, apiRoot), { recursive: true });

  writeFileSync(
    join(options.root, "typeforge.json"),
    JSON.stringify({ apiRoot }),
    "utf8"
  );
  writeFileSync(
    join(sourceDir, "source.ts"),
    options.sourceConfig ?? DEFAULT_SOURCE_CONFIG,
    "utf8"
  );
  writeFileSync(join(sourceDir, "spec.json"), options.specContent, "utf8");
  writeFileSync(
    join(options.root, apiRoot, "http.ts"),
    options.httpContent ?? DEFAULT_HTTP_SINGLETON,
    "utf8"
  );

  if (options.modelsContent !== undefined) {
    writeFileSync(
      join(options.root, apiRoot, "models.ts"),
      options.modelsContent,
      "utf8"
    );
  }
  if (options.knownTypesContent !== undefined) {
    writeFileSync(
      join(options.root, apiRoot, "known-types.ts"),
      options.knownTypesContent,
      "utf8"
    );
  }
  if (options.queryScopeContent !== undefined) {
    writeFileSync(
      join(options.root, apiRoot, "query-scope.ts"),
      options.queryScopeContent,
      "utf8"
    );
  }

  return { apiRoot, generatedDir, sourceDir };
}
