import { execFileSync } from "node:child_process";
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
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);
const postBody = readFileSync(
  join(fixtureRoot, "specs/post-body.json"),
  "utf8"
);

describe("integration: end-to-end type safety", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generated callers contain no response casts and use HTTPFetch generics", async () => {
    const root = join(fixtureRoot, "layouts", `typesafe-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceKey: "atlas",
      specContent: postBody,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });

    const postFn = readFileSync(
      join(
        root,
        "src/api/atlas/generated/functions/api/acme/v3/widgets/POST.ts"
      ),
      "utf8"
    );
    const deleteFn = readFileSync(
      join(
        root,
        "src/api/atlas/generated/functions/api/acme/v3/widgets/[slug]/DELETE.ts"
      ),
      "utf8"
    );

    for (const content of [postFn, deleteFn]) {
      expect(content).not.toMatch(/\bas\s+/);
      expect(content).toContain("return data;");
    }

    expect(postFn).toContain(".post<");
    expect(postFn).toContain("POSTApiAcmeV3WidgetsBody");
    expect(deleteFn).toContain(".delete<");
    expect(deleteFn).toContain("DELETEApiAcmeV3WidgetsSlugParams");
  });

  it("generated project typechecks with strict TypeScript", async () => {
    const root = join(fixtureRoot, "layouts", `tsc-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      httpContent: readFileSync(
        join(repoRoot, "test/fixtures/templates/typed-http.ts"),
        "utf8"
      ),
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });

    writeFileSync(
      join(root, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            lib: ["ES2022", "DOM"],
            module: "ESNext",
            moduleResolution: "Bundler",
            noEmit: true,
            strict: true,
            target: "ES2022",
          },
          include: ["src/**/*.ts"],
        },
        null,
        2
      ),
      "utf8"
    );

    let output = "";
    try {
      output = execFileSync(
        join(repoRoot, "node_modules/typescript/bin/tsc"),
        ["-p", root, "--pretty", "false"],
        { cwd: root, encoding: "utf8" }
      );
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string };
      throw new Error(
        [execError.stdout, execError.stderr].filter(Boolean).join("\n"),
        { cause: error }
      );
    }
    expect(output).toBeDefined();
  });
});

describe("integration: monolith layouts", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("generates with fetch adapter http.ts", async () => {
    const root = join(fixtureRoot, "layouts", `fetch-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      httpContent: `import { createFetchAdapter } from "@openmirai/typeforge/adapters/fetch";
export const httpFetch = createFetchAdapter({ baseURL: "https://example.com" });
export type { HTTPFetch, HTTPFetchConfig } from "@openmirai/typeforge/adapters/fetch";
`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    expect(
      existsSync(
        join(
          root,
          "src/api/atlas/generated/functions/api/acme/v3/widgets/GET.ts"
        )
      )
    ).toBe(true);
  });

  it("preserves merge-mode routes outside prefix", async () => {
    const root = join(fixtureRoot, "layouts", `merge-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      root,
      sourceConfig: `export default {
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "merge" as const,
};`,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    const routesPath = join(root, "src/api/atlas/generated/routes.ts");
    mkdirSync(join(root, "src/api/atlas/generated"), { recursive: true });
    writeFileSync(
      routesPath,
      `import {
  buildRouteFromHandlers,
  createRouteHandlers,
} from "@openmirai/typeforge/routes";

export enum RouteTargets {
  LEGACY_PING = "/v1/legacy/ping",
  API_ACME_V3_WIDGETS = "/acme/v3/widgets",
}
export type RouteParams = {
  LEGACY_PING: undefined;
  API_ACME_V3_WIDGETS: undefined;
};
export type RouteKey = keyof RouteParams;
export const Routes = createRouteHandlers<RouteParams>(RouteTargets);
export const buildRoute = buildRouteFromHandlers<RouteParams>(Routes);
`,
      "utf8"
    );

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const routes = readFileSync(routesPath, "utf8");
    expect(routes).toContain("/v1/legacy/ping");
    expect(routes).toContain("/acme/v3/widgets/:slug");
  });

  it("emits queryOptions when tanstackQuery is enabled", async () => {
    const root = join(fixtureRoot, "layouts", `query-scope-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      queryScopeContent: `export type QueryScope = { orgId: string };
export function getQueryScopeKey(scope: QueryScope) { return [scope.orgId]; }
`,
      root,
      sourceConfig: `export default {
  pathPrefix: "/api/acme/v3",
  stripApiPrefix: true,
  generationMode: "authoritative" as const,
  tanstackQuery: true,
};`,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const fn = readFileSync(
      join(
        root,
        "src/api/atlas/generated/functions/api/acme/v3/widgets/GET.ts"
      ),
      "utf8"
    );
    expect(fn).toContain("QueryOptions");
    expect(fn).toContain("getQueryScopeKey");
    expect(fn).not.toContain("@tanstack/react-query");
    expect(fn).toContain('from "../../../../../runtime"');
  });

  it("does not emit queryOptions when only query-scope.ts exists", async () => {
    const root = join(fixtureRoot, "layouts", `query-scope-off-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      queryScopeContent: `export type QueryScope = { orgId: string };
export function getQueryScopeKey(scope: QueryScope) { return [scope.orgId]; }
`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    await generateForSource({ cwd: root, sourceKey: "atlas" });
    const fn = readFileSync(
      join(
        root,
        "src/api/atlas/generated/functions/api/acme/v3/widgets/GET.ts"
      ),
      "utf8"
    );
    expect(fn).not.toContain("QueryOptions");
    expect(fn).not.toContain("@tanstack/react-query");
  });
});
