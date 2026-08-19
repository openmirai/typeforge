import { describe, expect, it } from "vitest";

import { buildRouteFromHandlers, createRouteHandlers } from "../build";

describe("createRouteHandlers", () => {
  const targets = {
    STATIC: "/widgets",
    BY_SLUG: "/widgets/:slug",
    BY_PHASE: "/widgets/:phase",
  } as const;

  const Routes = createRouteHandlers<{
    STATIC: undefined;
    BY_SLUG: { slug: string };
    BY_PHASE: { phase: "alpha" | "beta" };
  }>(targets);

  it("returns static routes as plain strings", () => {
    expect(Routes.STATIC).toBe("/widgets");
    expect(typeof Routes.STATIC).toBe("string");
  });

  it("builds dynamic routes with encodeURIComponent", () => {
    expect(Routes.BY_SLUG({ slug: "a/b" })).toBe("/widgets/a%2Fb");
    expect(Routes.BY_PHASE({ phase: "alpha" })).toBe("/widgets/alpha");
  });

  it("appends optional search params", () => {
    expect(Routes.STATIC).toBe("/widgets");
    expect(Routes.BY_SLUG({ slug: "acme" }, { page: 1, active: true })).toBe(
      "/widgets/acme?page=1&active=true"
    );
  });
});

describe("buildRouteFromHandlers", () => {
  const targets = {
    STATIC: "/widgets",
    BY_SLUG: "/widgets/:slug",
  } as const;

  const Routes = createRouteHandlers<{
    STATIC: undefined;
    BY_SLUG: { slug: string };
  }>(targets);
  const buildRoute = buildRouteFromHandlers(Routes);

  it("builds static and dynamic routes by key", () => {
    expect(buildRoute("STATIC")).toBe("/widgets");
    expect(buildRoute("BY_SLUG", { slug: "acme" })).toBe("/widgets/acme");
  });
});
