import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { emitRoutesFile, mergeRoutesFile } from "../index";
import { parseSpec } from "../../../parser/index";

const fixtureRoot = fileURLToPath(
  new URL("../../../../test/fixtures", import.meta.url)
);

describe("emitRoutesFile", () => {
  it("emits static and dynamic route members", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/envelope-list.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const content = emitRoutesFile({
      paths: source.paths,
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    expect(content).toContain('API_ACME_V3_WIDGETS = "/acme/v3/widgets"');
    expect(content).toContain("createRouteHandlers<RouteParams>(RouteTargets)");
    expect(content).toContain(
      "export const buildRoute = buildRouteFromHandlers<RouteParams>(Routes)"
    );
    expect(content).not.toContain("routeRegistry");
  });

  it("types dynamic route params from OpenAPI enums", () => {
    const source = parseSpec(
      JSON.parse(
        readFileSync(join(fixtureRoot, "specs/mutations.json"), "utf8")
      ),
      { pathPrefix: "/api/acme/v3" }
    );
    const content = emitRoutesFile({
      paths: source.paths,
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    expect(content).toContain('phase: "alpha" | "beta"');
    expect(content).not.toContain("routeRegistry");
  });
});

describe("mergeRoutesFile", () => {
  it("preserves routes outside the source prefix in merge mode", () => {
    const existing = emitRoutesFile({
      paths: [
        {
          cleanPath: "legacy/ping",
          operations: [],
          path: "/api/v1/legacy/ping",
        },
        {
          cleanPath: "v2/items",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    const incoming = emitRoutesFile({
      paths: [
        {
          cleanPath: "v2/items",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
        {
          cleanPath: "v2/new",
          operations: [],
          path: "/api/nova/v2/relay",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    const merged = mergeRoutesFile(
      existing,
      incoming,
      "RouteTargets",
      "/api/nova/v2"
    );

    expect(merged).toContain("/v1/legacy/ping");
    expect(merged).toContain("/nova/v2/relay");
  });

  it("merge without pathPrefix keeps all existing entries", () => {
    const existing = emitRoutesFile({
      paths: [
        {
          cleanPath: "legacy/ping",
          operations: [],
          path: "/api/v1/legacy/ping",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    const incoming = emitRoutesFile({
      paths: [
        {
          cleanPath: "v2/items",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    const merged = mergeRoutesFile(existing, incoming, "RouteTargets");
    expect(merged).toContain("/v1/legacy/ping");
    expect(merged).toContain("/acme/v3/widgets");
  });
});

describe("emitRoutesFile dedupe", () => {
  it("skips duplicate path enum entries", () => {
    const content = emitRoutesFile({
      paths: [
        {
          cleanPath: "v2/items",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
        {
          cleanPath: "v2/items",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: true,
    });

    expect(content.match(/API_ACME_V3_WIDGETS = "/g)?.length).toBe(1);
  });

  it("returns empty map when enum block is missing", () => {
    const merged = mergeRoutesFile(
      "export const Routes = {}",
      "export const Routes = {}",
      "MissingEnum"
    );
    expect(merged).toContain("export enum MissingEnum");
  });

  it("drops prefixed routes removed from incoming merge", () => {
    const existing = emitRoutesFile({
      paths: [
        {
          cleanPath: "api/acme/v3/widgets",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
        {
          cleanPath: "api/v2/legacy",
          operations: [],
          path: "/api/nova/v2/legacy",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: false,
    });

    const incoming = emitRoutesFile({
      paths: [
        {
          cleanPath: "api/acme/v3/widgets",
          operations: [],
          path: "/api/acme/v3/widgets",
        },
      ],
      routeEnumName: "RouteTargets",
      stripApiPrefix: false,
    });

    const merged = mergeRoutesFile(
      existing,
      incoming,
      "RouteTargets",
      "/api/nova/v2"
    );
    expect(merged).not.toContain("/api/nova/v2/legacy");
  });

  it("ignores malformed enum bodies without closing brace", () => {
    const merged = mergeRoutesFile(
      `export enum RouteTargets { API_ACME_V3_WIDGETS = "/acme/v3/widgets"`,
      `export enum RouteTargets { API_NOVA_V2_RELAY = "/nova/v2/relay" }`,
      "RouteTargets"
    );
    expect(merged).toContain("/nova/v2/relay");
  });
});
