import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { generateForSource } from "../../src/generate/index";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);
const rawCursorSpec = readFileSync(
  join(fixtureRoot, "specs/raw-cursor-list.json"),
  "utf8"
);
const mixedSpec = readFileSync(
  join(fixtureRoot, "specs/mixed-envelope.json"),
  "utf8"
);
const recursiveSpec = readFileSync(
  join(fixtureRoot, "specs/recursive-node.json"),
  "utf8"
);

describe("integration: monolith generate", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates wrapped output with base.ts for shared envelope specs", async () => {
    const root = join(fixtureRoot, "layouts", `wrapped-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    const result = await generateForSource({ cwd: root, sourceKey: "atlas" });
    expect(result.files).toBeGreaterThan(0);
    expect(existsSync(join(generatedDir, "base.ts"))).toBe(true);
    expect(existsSync(join(generatedDir, "routes.ts"))).toBe(true);
    expect(
      existsSync(join(generatedDir, "functions/api/acme/v3/widgets/GET.ts"))
    ).toBe(true);
  });

  it("generates raw output without base.ts for orbit-style specs", async () => {
    const root = join(fixtureRoot, "layouts", `raw-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      root,
      sourceConfig: `export default { pathPrefix: "/api/orbit/v1", stripApiPrefix: true, generationMode: "authoritative" as const };`,
      sourceKey: "orbit",
      specContent: rawCursorSpec,
    });

    await generateForSource({ cwd: root, sourceKey: "orbit" });
    expect(existsSync(join(generatedDir, "base.ts"))).toBe(false);
  });

  it("supports split function and type output directories with tsconfig aliases", async () => {
    const root = join(fixtureRoot, "layouts", `split-${Date.now()}`);
    tempRoots.push(root);
    const functionsDir = join(root, "packages/utils/src/api/routes/core/v2");
    const typesDir = join(root, "packages/types/src/api/core/v2");
    createMonolithProject({
      apiRoot: "packages/utils/src/api",
      root,
      sourceConfig: `export default {
  functionsDir: "packages/utils/src/api/routes/core/v2",
  typesDir: "packages/types/src/api/core/v2",
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "authoritative" as const,
};`,
      sourceKey: "core",
      specContent: singleEndpoint,
    });
    mkdirSync(join(root, "packages/utils"), { recursive: true });
    writeFileSync(
      join(root, "packages/utils/tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: {
            "@mirai/utils/src/*": ["./src/*"],
            "@mirai/*": ["../*"],
          },
        },
      }),
      "utf8"
    );
    mkdirSync(join(root, "packages/types"), { recursive: true });
    writeFileSync(
      join(root, "packages/types/tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: {
            "@mirai/types/src/*": ["./src/*"],
          },
        },
      }),
      "utf8"
    );

    await generateForSource({ cwd: root, sourceKey: "core" });

    expect(existsSync(join(typesDir, "../base.d.ts"))).toBe(true);
    expect(existsSync(join(typesDir, "../base.ts"))).toBe(false);
    expect(existsSync(join(typesDir, "api/acme/v3/widgets/GET.d.ts"))).toBe(
      true
    );
    const fn = readFileSync(
      join(functionsDir, "api/acme/v3/widgets/GET.ts"),
      "utf8"
    );
    expect(fn).toContain(
      'from "@mirai/types/src/api/core/v2/api/acme/v3/widgets/GET"'
    );
    expect(fn).toContain('from "@mirai/utils/src/api/core/generated/runtime"');
    expect(fn).not.toContain("../../../../");

    const responseType = readFileSync(
      join(typesDir, "api/acme/v3/widgets/GET.d.ts"),
      "utf8"
    );
    expect(responseType).toContain(
      'import("@mirai/types/src/api/core/base").BaseResponse'
    );
    expect(responseType).not.toContain("../../../../");
  });

  it("generates mixed envelope specs with per-operation wrapping", async () => {
    const root = join(fixtureRoot, "layouts", `mixed-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: mixedSpec,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    expect(existsSync(join(generatedDir, "base.ts"))).toBe(true);

    const wrappedType = readFileSync(
      join(generatedDir, "types/api/acme/v3/widgets/GET.d.ts"),
      "utf8"
    );
    expect(wrappedType).toContain("BaseResponse<");

    const rawType = readFileSync(
      join(generatedDir, "types/api/acme/v3/plain/[token]/GET.d.ts"),
      "utf8"
    );
    expect(rawType).not.toContain("BaseResponse<");
    expect(rawType).toContain("token");

    const secondaryEnvelopeType = readFileSync(
      join(generatedDir, "types/api/acme/v3/secondary/GET.d.ts"),
      "utf8"
    );
    expect(secondaryEnvelopeType).not.toContain("BaseResponse<");
    expect(secondaryEnvelopeType).toContain("cursor?: string");
  });

  it("fails generate for recursive schemas without known-type override", async () => {
    const root = join(fixtureRoot, "layouts", `recursive-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: recursiveSpec,
    });

    await expect(
      generateForSource({ cwd: root, sourceKey: "atlas" })
    ).rejects.toThrow(/recursive schema reference/i);
  });

  it("applies user known-types overrides during generate", async () => {
    const root = join(fixtureRoot, "layouts", `known-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      knownTypesContent: `export const knownTypes = [
  {
    name: "BlobAsset",
    typeName: "BlobAsset",
    importPath: "./blob/types",
    exactProperties: ["handle", "uri", "payload"],
  },
];`,
      root,
      sourceKey: "atlas",
      specContent: readFileSync(
        join(fixtureRoot, "specs/blob-endpoint.json"),
        "utf8"
      ),
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const typesDir = join(generatedDir, "types");
    const typeFiles = readFileSync(
      join(typesDir, "api/acme/v3/blobs/[handle]/GET.d.ts"),
      "utf8"
    );
    expect(typeFiles).toContain("BlobAsset");
  });

  it("fails when models.ts BaseResponse drifts from spec", async () => {
    const root = join(fixtureRoot, "layouts", `drift-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await expect(
      generateForSource({ cwd: root, sourceKey: "atlas" })
    ).rejects.toThrow(/base response mismatch|drift/i);
  });

  it("accept-base patches models.ts and writes generated base", async () => {
    const root = join(fixtureRoot, "layouts", `accept-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

export type ItemResponse = BaseResponse<{ id: string }>;`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({
      acceptBase: true,
      cwd: root,
      sourceKey: "atlas",
    });

    const models = readFileSync(join(root, "src/api/models.ts"), "utf8");
    expect(models).toContain("export interface BaseResponse<T>");
    expect(models).toContain("ItemResponse");
    expect(models).not.toContain("error?: string");
  });

  it("check mode reports stale files without writing", async () => {
    const root = join(fixtureRoot, "layouts", `check-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    writeFileSync(join(generatedDir, "routes.ts"), "// stale\n", "utf8");

    const result = await generateForSource({
      check: true,
      cwd: root,
      sourceKey: "atlas",
    });
    expect(result.check).toBe(true);
    expect(result.changed.length).toBeGreaterThan(0);
    expect(readFileSync(join(generatedDir, "routes.ts"), "utf8")).toBe(
      "// stale\n"
    );
  });

  it("uses injected http mode when http.ts has no httpFetch export", async () => {
    const root = join(fixtureRoot, "layouts", `injected-${Date.now()}`);
    tempRoots.push(root);
    const { generatedDir } = createMonolithProject({
      httpContent: `export type HTTPFetch = {
  get: () => Promise<{ data: unknown }>;
  post: () => Promise<{ data: unknown }>;
  put: () => Promise<{ data: unknown }>;
  patch: () => Promise<{ data: unknown }>;
  delete: () => Promise<{ data: unknown }>;
};`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const fn = readFileSync(
      join(generatedDir, "functions/api/acme/v3/widgets/GET.ts"),
      "utf8"
    );
    expect(fn).toContain("http: HTTPFetch");
    expect(fn).not.toContain("import { httpFetch }");
  });
});

describe("integration: multi-source", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates two sources independently", async () => {
    const root = join(fixtureRoot, "layouts", `multi-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, "src/api/wrapped"), { recursive: true });
    mkdirSync(join(root, "src/api/raw"), { recursive: true });
    writeFileSync(
      join(root, "openapi-codegen.json"),
      JSON.stringify({ apiRoot: "src/api" }),
      "utf8"
    );
    writeFileSync(
      join(root, "src/api/http.ts"),
      `export const httpFetch = {} as never;\n`,
      "utf8"
    );
    writeFileSync(
      join(root, "src/api/wrapped/source.ts"),
      `export default { pathPrefix: "/api/acme/v3", stripApiPrefix: true, generationMode: "authoritative" as const };`,
      "utf8"
    );
    writeFileSync(
      join(root, "src/api/wrapped/spec.json"),
      singleEndpoint,
      "utf8"
    );
    writeFileSync(
      join(root, "src/api/raw/source.ts"),
      `export default { pathPrefix: "/api/orbit/v1", stripApiPrefix: true, generationMode: "authoritative" as const };`,
      "utf8"
    );
    writeFileSync(join(root, "src/api/raw/spec.json"), rawCursorSpec, "utf8");

    await generateForSource({ cwd: root, sourceKey: "wrapped" });
    await generateForSource({ cwd: root, sourceKey: "raw" });

    expect(existsSync(join(root, "src/api/wrapped/generated/base.ts"))).toBe(
      true
    );
    expect(existsSync(join(root, "src/api/raw/generated/base.ts"))).toBe(false);
  });
});
