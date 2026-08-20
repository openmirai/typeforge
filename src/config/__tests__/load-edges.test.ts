import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  detectHttpMode,
  listSourceKeys,
  loadProjectConfig,
  loadSourceConfig,
  readModelsFile,
} from "../load";

describe("config/load edge cases", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("falls back when config files are malformed", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `config-bad-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });
    writeFileSync(join(cwd, "openapi-codegen.json"), "{not json", "utf8");
    writeFileSync(
      join(cwd, "package.json"),
      JSON.stringify({ openapiCodegen: "invalid" }),
      "utf8"
    );

    expect(loadProjectConfig(cwd).apiRoot).toBe("src/api");
  });

  it("parses optional source.ts fields", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-extra-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `export default {
  ignorePaths: ["/health"],
  routeEnumName: "Routes",
  naming: "operationId",
  queryExtends: {
    sortBy: "sortBy",
    sortOrder: "sortOrder",
    sortTypeName: "SortParams",
    sortImportPath: "./sort",
  },
};`,
      "utf8"
    );

    const config = loadSourceConfig(cwd, "src/api", "atlas");
    expect(config.ignorePaths).toEqual(["/health"]);
    expect(config.routeEnumName).toBe("Routes");
    expect(config.naming).toBe("operationId");
    expect(config.queryExtends?.sortTypeName).toBe("SortParams");
  });

  it("parses tanstackQuery when enabled in source.ts", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-tanstack-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `export default { tanstackQuery: true };`,
      "utf8"
    );

    expect(loadSourceConfig(cwd, "src/api", "atlas").tanstackQuery).toBe(true);
  });

  it("returns empty source config when source.ts is missing", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-missing-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });
    expect(loadSourceConfig(cwd, "src/api", "atlas")).toEqual({});
  });

  it("reads models and detects exported httpFetch re-export", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `models-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/models.ts"),
      "export interface BaseResponse<T> { data?: T; }",
      "utf8"
    );
    writeFileSync(
      join(cwd, "src/api/http.ts"),
      `export { httpFetch } from "./client";`,
      "utf8"
    );

    expect(readModelsFile(cwd, "src/api")).toContain("BaseResponse");
    expect(detectHttpMode(cwd, "src/api")).toBe("singleton");
    expect(listSourceKeys(cwd, "missing-root")).toEqual([]);
  });

  it("parses spec path from source.ts", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-spec-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `export default {
  spec: "../mirai-core-api/cmd/admin/docs/swagger.json",
  pathPrefix: "/api/v2",
};`,
      "utf8"
    );

    const config = loadSourceConfig(cwd, "src/api", "atlas");
    expect(config.spec).toBe("../mirai-core-api/cmd/admin/docs/swagger.json");
    expect(config.pathPrefix).toBe("/api/v2");
  });

  it("spec field is undefined when not set in source.ts", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `source-no-spec-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(join(cwd, "src/api/atlas"), { recursive: true });
    writeFileSync(
      join(cwd, "src/api/atlas/source.ts"),
      `export default { pathPrefix: "/api/v2" };`,
      "utf8"
    );

    const config = loadSourceConfig(cwd, "src/api", "atlas");
    expect(config.spec).toBeUndefined();
  });

  it("returns injected mode when http.ts is missing", () => {
    const cwd = join(
      process.cwd(),
      "test/fixtures/layouts",
      `http-missing-${Date.now()}`
    );
    tempRoots.push(cwd);
    mkdirSync(cwd, { recursive: true });
    expect(detectHttpMode(cwd, "src/api")).toBe("injected");
  });
});
