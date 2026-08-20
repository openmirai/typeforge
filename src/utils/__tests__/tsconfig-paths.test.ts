import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadTsconfigPaths, resolveAliasImport } from "../tsconfig-paths";
import { resolveAliasAwareImport } from "../imports";

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(
    process.env["TMPDIR"] ?? "/tmp",
    `tsconfig-paths-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { force: true, recursive: true });
});

function writeTsconfig(content: string): void {
  writeFileSync(join(tmpDir, "tsconfig.json"), content, "utf8");
}

// ---------------------------------------------------------------------------
// loadTsconfigPaths
// ---------------------------------------------------------------------------

describe("loadTsconfigPaths", () => {
  it("returns undefined when tsconfig.json does not exist", () => {
    expect(loadTsconfigPaths(tmpDir)).toBeUndefined();
  });

  it("returns undefined when paths is not present", () => {
    writeTsconfig(JSON.stringify({ compilerOptions: { strict: true } }));
    expect(loadTsconfigPaths(tmpDir)).toBeUndefined();
  });

  it("returns undefined when paths is empty", () => {
    writeTsconfig(JSON.stringify({ compilerOptions: { paths: {} } }));
    expect(loadTsconfigPaths(tmpDir)).toBeUndefined();
  });

  it("parses wildcard paths with baseUrl", () => {
    writeTsconfig(
      JSON.stringify({
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@mirai/utils/*": ["packages/utils/src/*"],
          },
        },
      })
    );

    const result = loadTsconfigPaths(tmpDir);
    expect(result).not.toBeUndefined();
    expect(result?.paths).toEqual({
      "@mirai/utils/*": ["packages/utils/src/*"],
    });
    expect(result?.resolvedBaseUrl).toBe(resolve(tmpDir, "."));
  });

  it("handles tsconfig with // line comments", () => {
    writeTsconfig(`{
      // This is a comment
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@foo/*": ["src/*"] // trailing comment
        }
      }
    }`);

    const result = loadTsconfigPaths(tmpDir);
    expect(result?.paths).toEqual({ "@foo/*": ["src/*"] });
  });

  it("handles tsconfig with /* block comments */ and trailing commas", () => {
    writeTsconfig(`{
      /* block comment */
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@bar/*": ["lib/*"],
        },
      },
    }`);

    const result = loadTsconfigPaths(tmpDir);
    expect(result?.paths).toEqual({ "@bar/*": ["lib/*"] });
  });

  it("defaults baseUrl to cwd when not set", () => {
    writeTsconfig(
      JSON.stringify({
        compilerOptions: {
          paths: { "@pkg/*": ["packages/pkg/src/*"] },
        },
      })
    );

    const result = loadTsconfigPaths(tmpDir);
    expect(result?.resolvedBaseUrl).toBe(resolve(tmpDir, "."));
  });

  it("finds the nearest tsconfig from a nested output directory", () => {
    const packageDir = join(tmpDir, "packages/utils");
    const outputDir = join(packageDir, "src/api/routes/core/v2");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(packageDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { "@mirai/utils/*": ["src/*"] } },
      }),
      "utf8"
    );

    const result = loadTsconfigPaths(outputDir);
    expect(result?.baseDir).toBe(packageDir);
    expect(result?.resolvedBaseUrl).toBe(packageDir);
  });

  it("continues upward when a nearer tsconfig has no path aliases", () => {
    const packageDir = join(tmpDir, "packages/utils");
    const outputDir = join(packageDir, "src/api/routes");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(tmpDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { paths: { "@workspace/*": ["packages/*"] } },
      }),
      "utf8"
    );
    writeFileSync(
      join(packageDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }),
      "utf8"
    );

    const result = loadTsconfigPaths(outputDir);
    expect(result?.baseDir).toBe(tmpDir);
    expect(result?.paths).toEqual({ "@workspace/*": ["packages/*"] });
  });

  it("returns undefined for malformed JSON", () => {
    writeFileSync(join(tmpDir, "tsconfig.json"), "{ not valid json }", "utf8");
    expect(loadTsconfigPaths(tmpDir)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveAliasImport
// ---------------------------------------------------------------------------

describe("resolveAliasImport", () => {
  it("resolves wildcard alias for a nested target", () => {
    const config = {
      baseDir: "/project",
      paths: { "@mirai/utils/*": ["packages/utils/src/*"] },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport(
        "/project/packages/utils/src/api/v2/generated/runtime",
        config
      )
    ).toBe("@mirai/utils/api/v2/generated/runtime");
  });

  it("resolves wildcard alias for a deep types target", () => {
    const config = {
      baseDir: "/project",
      paths: { "@mirai/utils/*": ["packages/utils/src/*"] },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport(
        "/project/packages/utils/src/api/v2/generated/types/api/v2/auth/email/validate/POST",
        config
      )
    ).toBe(
      "@mirai/utils/api/v2/generated/types/api/v2/auth/email/validate/POST"
    );
  });

  it("returns undefined when no alias matches", () => {
    const config = {
      baseDir: "/project",
      paths: { "@other/*": ["other/src/*"] },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport("/project/packages/utils/src/runtime", config)
    ).toBeUndefined();
  });

  it("resolves exact alias (no wildcard)", () => {
    const config = {
      baseDir: "/project",
      paths: { "@utils/runtime": ["packages/utils/src/runtime.ts"] },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport("/project/packages/utils/src/runtime", config)
    ).toBe("@utils/runtime");
  });

  it("resolves exact alias stripping .ts extension from target", () => {
    const config = {
      baseDir: "/project",
      paths: { "@utils/runtime": ["packages/utils/src/runtime"] },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport("/project/packages/utils/src/runtime.ts", config)
    ).toBe("@utils/runtime");
  });

  it("uses multiple path aliases and picks first match", () => {
    const config = {
      baseDir: "/project",
      paths: {
        "@other/*": ["other/src/*"],
        "@mirai/utils/*": ["packages/utils/src/*"],
      },
      resolvedBaseUrl: "/project",
    };

    expect(
      resolveAliasImport(
        "/project/packages/utils/src/api/v2/generated/runtime",
        config
      )
    ).toBe("@mirai/utils/api/v2/generated/runtime");
  });
});

// ---------------------------------------------------------------------------
// resolveAliasAwareImport
// ---------------------------------------------------------------------------

describe("resolveAliasAwareImport", () => {
  it("falls back to relative when no alias config provided", () => {
    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/generated/functions/api/v2/auth/email/validate/POST.ts",
      toAbsolutePath: "/project/generated/runtime",
    });
    expect(result).toBe("../../../../../../runtime");
  });

  it("uses importBase override for runtime", () => {
    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/generated/functions/api/v2/auth/email/validate/POST.ts",
      generatedDir: "/project/generated",
      importBase: "@mirai/utils/src/api/v2/generated",
      toAbsolutePath: "/project/generated/runtime",
    });
    expect(result).toBe("@mirai/utils/src/api/v2/generated/runtime");
  });

  it("uses importBase override for types", () => {
    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/generated/functions/api/v2/auth/email/validate/POST.ts",
      generatedDir: "/project/generated",
      importBase: "@mirai/utils/src/api/v2/generated",
      toAbsolutePath:
        "/project/generated/types/api/v2/auth/email/validate/POST",
    });
    expect(result).toBe(
      "@mirai/utils/src/api/v2/generated/types/api/v2/auth/email/validate/POST"
    );
  });

  it("resolves via tsconfig alias when relative path has ≥3 ../ segments", () => {
    const config = {
      baseDir: "/project",
      paths: { "@mirai/utils/*": ["packages/utils/src/*"] },
      resolvedBaseUrl: "/project",
    };

    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/packages/utils/src/api/v2/generated/functions/api/v2/auth/email/validate/POST.ts",
      toAbsolutePath: "/project/packages/utils/src/api/v2/generated/runtime",
      tsconfigPaths: config,
    });
    expect(result).toBe("@mirai/utils/api/v2/generated/runtime");
  });

  it("does not use tsconfig alias for shallow relative paths (<3 ../ segments)", () => {
    const config = {
      baseDir: "/project",
      paths: { "@mirai/utils/*": ["packages/utils/src/*"] },
      resolvedBaseUrl: "/project",
    };

    // Shallow path: only 1 level deep → relative is "../runtime"
    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/packages/utils/src/api/v2/generated/functions/widgets/GET.ts",
      toAbsolutePath: "/project/packages/utils/src/api/v2/generated/runtime",
      tsconfigPaths: config,
    });
    // 2 ../ → below threshold (3), so relative is kept
    // from: /project/packages/utils/src/api/v2/generated/functions/widgets
    // to:   /project/packages/utils/src/api/v2/generated/runtime
    // relative: ../../runtime  (2 segments)
    expect(result).toBe("../../runtime");
  });

  it("falls back to relative when tsconfig alias has no match", () => {
    const config = {
      baseDir: "/project",
      paths: { "@other/*": ["other/src/*"] },
      resolvedBaseUrl: "/project",
    };

    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/packages/utils/src/api/v2/generated/functions/api/v2/auth/email/validate/POST.ts",
      toAbsolutePath: "/project/packages/utils/src/api/v2/generated/runtime",
      tsconfigPaths: config,
    });
    expect(result).toMatch(/^\.\./);
  });

  it("importBase takes precedence over tsconfigPaths", () => {
    const config = {
      baseDir: "/project",
      paths: { "@mirai/utils/*": ["packages/utils/src/*"] },
      resolvedBaseUrl: "/project",
    };

    const result = resolveAliasAwareImport({
      fromAbsolutePath:
        "/project/packages/utils/src/api/v2/generated/functions/api/v2/auth/GET.ts",
      generatedDir: "/project/packages/utils/src/api/v2/generated",
      importBase: "@explicit/base/generated",
      toAbsolutePath: "/project/packages/utils/src/api/v2/generated/runtime",
      tsconfigPaths: config,
    });
    expect(result).toBe("@explicit/base/generated/runtime");
  });
});
