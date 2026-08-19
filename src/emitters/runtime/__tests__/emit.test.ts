import { describe, expect, it } from "vitest";

import { emitRuntimeFile } from "../index";

describe("emitRuntimeFile", () => {
  it("re-exports http and routes with fixed short paths", () => {
    const content = emitRuntimeFile({
      hasQueryScope: false,
      httpMode: "singleton",
    });

    expect(content).toContain('from "../../http"');
    expect(content).toContain('from "./routes"');
    expect(content).not.toContain("@tanstack/react-query");
  });

  it("omits httpFetch for injected mode", () => {
    const content = emitRuntimeFile({
      hasQueryScope: false,
      httpMode: "injected",
    });

    expect(content).toContain("export type { HTTPFetch, HTTPFetchConfig }");
    expect(content).not.toContain("export { httpFetch }");
  });

  it("re-exports tanstack query helpers when enabled", () => {
    const content = emitRuntimeFile({
      hasQueryScope: true,
      httpMode: "singleton",
    });

    expect(content).toContain('from "../../query-scope"');
    expect(content).toContain('@tanstack/react-query"');
  });
});
