import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { generateForSource } from "../../src/generate/index";
import { resolveSpecSource } from "../../src/parser/loader";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);

describe("integration: spec resolution", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("resolves OPENAPI_SPEC_<SOURCE> env var", async () => {
    const root = join(fixtureRoot, "layouts", `env-spec-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: "{}",
    });
    rmSync(join(root, "src/api/atlas/spec.json"));

    const specPath = join(fixtureRoot, "specs/envelope-list.json");
    const previous = process.env["OPENAPI_SPEC_ATLAS"];
    process.env["OPENAPI_SPEC_ATLAS"] = specPath;
    try {
      const result = await generateForSource({ cwd: root, sourceKey: "atlas" });
      expect(result.files).toBeGreaterThan(0);
    } finally {
      if (previous === undefined) {
        delete process.env["OPENAPI_SPEC_ATLAS"];
      } else {
        process.env["OPENAPI_SPEC_ATLAS"] = previous;
      }
    }
  });

  it("resolves openapi-codegen.local.json override", () => {
    const root = join(fixtureRoot, "layouts", `local-spec-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(root, { recursive: true });
    const specPath = join(fixtureRoot, "specs/envelope-list.json");
    writeFileSync(
      join(root, "openapi-codegen.local.json"),
      JSON.stringify({ atlas: specPath }),
      "utf8"
    );

    const source = resolveSpecSource("atlas", {
      localOverridePath: join(root, "openapi-codegen.local.json"),
    });
    expect(source.kind).toBe("local-override");
  });
});

describe("integration: query extends", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("extends pagination params in generated query interfaces", async () => {
    const root = join(fixtureRoot, "layouts", `query-extends-${Date.now()}`);
    tempRoots.push(root);
    const paginatedSpec = JSON.stringify({
      openapi: "3.0.0",
      info: { title: "Paginated", version: "1.0.0" },
      paths: {
        "/api/acme/v3/widgets": {
          get: {
            parameters: [
              { in: "query", name: "page", schema: { type: "integer" } },
              { in: "query", name: "limit", schema: { type: "integer" } },
            ],
            responses: {
              "200": {
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      properties: {
                        success: { type: "boolean" },
                        data: { type: "array", items: { type: "string" } },
                        timestamp: { type: "string" },
                      },
                      required: ["success", "timestamp"],
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    createMonolithProject({
      root,
      sourceConfig: `export default {
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "authoritative" as const,
  queryExtends: {
    page: "page",
    limit: "limit",
    paginationTypeName: "OffsetLimitQuery",
    paginationImportPath: "./pagination",
  },
};`,
      sourceKey: "atlas",
      specContent: paginatedSpec,
    });
    writeFileSync(
      join(root, "src/api/pagination.ts"),
      "export interface OffsetLimitQuery { page?: number; limit?: number; }\n",
      "utf8"
    );

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const types = readFileSync(
      join(root, "src/api/atlas/generated/types/api/acme/v3/widgets/GET.d.ts"),
      "utf8"
    );
    expect(types).toContain("OffsetLimitQuery");
    expect(types).toMatch(/type GETApiAcmeV3WidgetsParams = OffsetLimitQuery/);
  });
});
