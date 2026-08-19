import { describe, expect, it } from "vitest";

import { relativeImportFromFunctionFile, relativeImportPath } from "../imports";

describe("relativeImportPath", () => {
  it("computes nested relative imports", () => {
    expect(
      relativeImportPath(
        "/project/generated/functions/api/acme/v3/widgets/GET.ts",
        "/project/generated/types/api/acme/v3/widgets/GET"
      )
    ).toBe("../../../../../types/api/acme/v3/widgets/GET");

    expect(
      relativeImportPath(
        "/project/generated/types/api/acme/v3/widgets/GET.d.ts",
        "/project/generated/base"
      )
    ).toBe("../../../../../base");

    expect(
      relativeImportPath(
        "/project/generated/routes.ts",
        "/project/generated/routes"
      )
    ).toBe("./routes");
  });
});

describe("relativeImportFromFunctionFile", () => {
  it("imports generated runtime from nested function files", () => {
    expect(
      relativeImportFromFunctionFile("api/acme/v3/widgets/[slug]", "runtime")
    ).toBe("../../../../../../runtime");
  });
});
