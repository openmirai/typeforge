import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emitFunctionFiles } from "../index";
import { parseSpec } from "../../../parser/index";

const fixtureRoot = fileURLToPath(
  new URL("../../../../test/fixtures", import.meta.url)
);

function baseOptions(paths: ReturnType<typeof parseSpec>["paths"]) {
  const root = "/project/src/api/atlas/generated";
  return {
    functionsDir: `${root}/functions`,
    generatedDir: root,
    hasQueryScope: false,
    httpMode: "singleton" as const,
    paths,
    routeEnumName: "RouteTargets",
    typesDir: `${root}/types`,
  };
}

describe("emitFunctionFiles", () => {
  it("emits GET callers with params and singleton httpFetch", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const [file] = emitFunctionFiles(baseOptions(source.paths));
    expect(file?.content).toContain("import { httpFetch, Routes }");
    expect(file?.content).toContain("params?: GETApiAcmeV3WidgetsParams");
    expect(file?.content).toContain(
      "httpFetch.get<GETApiAcmeV3WidgetsResponse, GETApiAcmeV3WidgetsParams>(Routes.API_ACME_V3_WIDGETS, { ...config, params, signal });"
    );
    expect(file?.content).toContain("return data;");
    expect(file?.content).not.toContain("Response | undefined");
    expect(file?.content).not.toMatch(/\bas\s+/);
  });

  it("emits POST body as required and DELETE query params", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/post-body.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const files = emitFunctionFiles(baseOptions(source.paths));
    const post = files.find((file) => file.relativePath.endsWith("POST.ts"));
    const del = files.find((file) => file.relativePath.endsWith("DELETE.ts"));

    expect(post?.content).toContain("body: POSTApiAcmeV3WidgetsBody");
    expect(post?.content).toContain(
      "httpFetch.post<POSTApiAcmeV3WidgetsResponse, POSTApiAcmeV3WidgetsBody>"
    );
    expect(post?.content).not.toMatch(/\bas\s+/);
    expect(del?.content).toContain("params?: DELETEApiAcmeV3WidgetsSlugParams");
  });

  it("requires params when the operation has a required query parameter", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const operation = source.paths[0]?.operations[0];
    if (operation?.queryParams[0] !== undefined) {
      operation.queryParams[0].required = true;
    }

    const [file] = emitFunctionFiles(baseOptions(source.paths));
    expect(file?.content).toContain("params: GETApiAcmeV3WidgetsParams");
    expect(file?.content).not.toContain("params?: GETApiAcmeV3WidgetsParams");
  });

  it("passes request bodies through DELETE config", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/post-body.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const operation = source.paths[1]?.operations[0];
    if (operation !== undefined) {
      operation.requestBody = {
        required: true,
        schema: {
          kind: "object",
          properties: {
            force: { required: true, schema: { kind: "boolean" } },
          },
        },
      };
    }

    const file = emitFunctionFiles(baseOptions(source.paths)).find((entry) =>
      entry.relativePath.endsWith("DELETE.ts")
    );
    expect(file?.content).toContain("body: DELETEApiAcmeV3WidgetsSlugBody");
    expect(file?.content).toContain("data: body, params, signal");
  });

  it("uses injected http prop when httpMode is injected", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const [file] = emitFunctionFiles({
      ...baseOptions(source.paths),
      httpMode: "injected",
    });
    expect(file?.content).toContain("http: HTTPFetch");
    expect(file?.content).toContain(
      "props.http.get<GETApiAcmeV3WidgetsResponse, GETApiAcmeV3WidgetsParams>(Routes.API_ACME_V3_WIDGETS"
    );
    expect(file?.content).not.toContain("import { httpFetch }");
  });

  it("computes nested relative imports for deep paths", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const itemFile = emitFunctionFiles(baseOptions(source.paths)).find((file) =>
      file.relativePath.includes("[slug]")
    );
    expect(itemFile?.content).toContain(
      'from "../../../../../../types/api/acme/v3/widgets/[slug]/GET"'
    );
    expect(itemFile?.content).toContain('from "../../../../../../runtime"');
    expect(itemFile?.content).not.toContain("/http");
    expect(itemFile?.content).not.toContain("/routes");
  });

  it("emits PUT and PATCH callers with typed bodies", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/mutations.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const files = emitFunctionFiles(baseOptions(source.paths));
    const put = files.find((file) => file.relativePath.endsWith("PUT.ts"));
    const patch = files.find((file) => file.relativePath.endsWith("PATCH.ts"));

    expect(put?.content).toContain(".put<");
    expect(patch?.content).toContain(".patch<");
    expect(put?.content).toContain('phase: "alpha" | "beta"');
  });

  it("emits queryOptions helper when query scope is enabled", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const [file] = emitFunctionFiles({
      ...baseOptions(source.paths),
      hasQueryScope: true,
    });
    expect(file?.content).toContain("getQueryScopeKey");
    expect(file?.content).toContain("QueryOptions");
    expect(file?.content).not.toContain("@tanstack/react-query");
    expect(file?.content).toContain('from "../../../../../runtime"');

    const itemFile = emitFunctionFiles({
      ...baseOptions(source.paths),
      hasQueryScope: true,
    }).find((entry) => entry.relativePath.includes("[slug]"));
    expect(itemFile?.content).toContain("const { queryScope } = props;");
    expect(itemFile?.content).not.toContain(", params]");
  });

  it("defaults missing path params to string", () => {
    const files = emitFunctionFiles({
      ...baseOptions([]),
      paths: [
        {
          cleanPath: "api/acme/v3/widgets/[slug]",
          operations: [
            {
              method: "get",
              pathParams: [],
              queryParams: [],
              responses: [
                {
                  schema: { kind: "object", properties: {} },
                  statusCode: "200",
                },
              ],
            },
          ],
          path: "/api/acme/v3/widgets/{slug}",
        },
      ],
    });
    expect(files[0]?.content).toContain("slug: string");
  });
});
