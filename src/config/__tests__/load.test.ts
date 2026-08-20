import { describe, expect, it } from "vitest";

import {
  detectHttpMode,
  hasQueryScopeFile,
  loadProjectConfig,
  loadSourceConfig,
  listSourceKeys,
} from "../load";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function sortedStrings(values: Array<string>): Array<string> {
  return values.slice().toSorted((left, right) => left.localeCompare(right));
}

describe("config/load", () => {
  it("loads apiRoot from openapi-codegen.json and package.json", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `config-${Date.now()}`
    );
    mkdirSync(cwd, { recursive: true });
    writeFileSync(
      join(cwd, "openapi-codegen.json"),
      JSON.stringify({ apiRoot: "packages/utils/src/api" }),
      "utf8"
    );
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ openapiCodegen: { apiRoot: "ignored" } }),
      "utf8"
    );

    expect(loadProjectConfig(cwd).apiRoot).toBe("packages/utils/src/api");
  });

  it("parses source.ts config fields", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-${Date.now()}`
    );
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `export default {
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "merge" as const,
  resolveMapKeyRefs: false,
  maxRenderDepth: 42,
  queryExtends: {
    page: "page",
    limit: "limit",
    paginationTypeName: "OffsetLimitQuery",
    paginationImportPath: "./pagination",
  },
};`,
      "utf8"
    );

    const config = loadSourceConfig(cwd, "src/api", "atlas");
    expect(config.pathPrefix).toBe("/api/acme/v3");
    expect(config.stripApiPrefix).toBe(true);
    expect(config.generationMode).toBe("merge");
    expect(config.resolveMapKeyRefs).toBe(false);
    expect(config.maxRenderDepth).toBe(42);
    expect(config.queryExtends?.paginationTypeName).toBe("OffsetLimitQuery");
  });

  it("detects singleton vs injected http mode", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `http-${Date.now()}`
    );
    mkdirSync(join(cwd, "src/api"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/http.ts"),
      `export const httpFetch = {} as never;`,
      "utf8"
    );
    expect(detectHttpMode(cwd, "src/api")).toBe("singleton");

    writeFileSync(
      join(cwd, "src/api/http.ts"),
      `export type HTTPFetch = { get: () => Promise<unknown> };`,
      "utf8"
    );
    expect(detectHttpMode(cwd, "src/api")).toBe("injected");
  });

  it("parses defineSourceConfig-wrapped source.ts", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-define-${Date.now()}`
    );
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `import { defineSourceConfig } from "@openmirai/openapi-codegen";

export default defineSourceConfig({
  spec: "./specs/acme.json",
  functionsDir: "packages/utils/src/api/routes/atlas",
  typesDir: "packages/types/src/api/atlas",
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "merge",
  naming: "operationId",
  tanstackQuery: true,
  importBase: "@acme/api/generated",
  maxRenderDepth: 42,
  queryExtends: {
    page: "page",
    limit: "limit",
    paginationTypeName: "OffsetLimitQuery",
    paginationImportPath: "./pagination",
  },
});`,
      "utf8"
    );

    const config = loadSourceConfig(cwd, "src/api", "atlas");
    expect(config.spec).toBe("./specs/acme.json");
    expect(config.functionsDir).toBe("packages/utils/src/api/routes/atlas");
    expect(config.typesDir).toBe("packages/types/src/api/atlas");
    expect(config.pathPrefix).toBe("/api/acme/v3");
    expect(config.stripApiPrefix).toBe(true);
    expect(config.generationMode).toBe("merge");
    expect(config.naming).toBe("operationId");
    expect(config.tanstackQuery).toBe(true);
    expect(config.importBase).toBe("@acme/api/generated");
    expect(config.maxRenderDepth).toBe(42);
    expect(config.queryExtends?.paginationTypeName).toBe("OffsetLimitQuery");
  });

  it("lists source keys by source.ts presence", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `sources-${Date.now()}`
    );
    mkdirSync(join(cwd, "src/api/alpha"), { recursive: true });
    mkdirSync(join(cwd, "src/api/beta"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/alpha/source.ts"),
      "export default {};",
      "utf8"
    );
    writeFileSync(
      join(cwd, "src/api/beta/source.ts"),
      "export default {};",
      "utf8"
    );

    expect(sortedStrings(listSourceKeys(cwd, "src/api"))).toEqual([
      "alpha",
      "beta",
    ]);
    expect(hasQueryScopeFile(cwd, "src/api")).toBe(false);
  });
});
