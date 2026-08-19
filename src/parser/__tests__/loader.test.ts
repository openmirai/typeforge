import { stripVTControlCharacters } from "node:util";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadSpec, resolveSpecSource } from "../loader";
import type { JsonValue } from "../../json/types";

const testDir = join(tmpdir(), `openapi-codegen-loader-${Date.now()}`);

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  throw error;
}

function writeSpec(filename: string, content: JsonValue): string {
  const p = join(testDir, filename);
  writeFileSync(p, JSON.stringify(content));
  return p;
}

beforeEach(() => {
  mkdirSync(testDir, { recursive: true });
});

afterEach(() => {
  rmSync(testDir, { force: true, recursive: true });
  vi.unstubAllEnvs();
  delete process.env["NO_COLOR"];
});

// ---------------------------------------------------------------------------
// LoadSpec
// ---------------------------------------------------------------------------

describe("loadSpec - file source", () => {
  it("reads and parses JSON from a file path", async () => {
    const spec = {
        info: { title: "T", version: "1" },
        openapi: "3.0.0",
        paths: {},
      },
      p = writeSpec("spec.json", spec),
      result = await loadSpec({ kind: "file", path: p });
    expect(result).toEqual(spec);
  });

  it("rejects when file does not exist", async () => {
    await expect(
      loadSpec({ kind: "file", path: join(testDir, "missing.json") })
    ).rejects.toThrow("ENOENT");
  });
});

describe("loadSpec - env source", () => {
  it("reads path from env var and parses JSON", async () => {
    const spec = {
        info: { title: "T", version: "1" },
        paths: {},
        swagger: "2.0",
      },
      p = writeSpec("env-spec.json", spec);
    vi.stubEnv("OPENAPI_SPEC_MY_SOURCE", p);

    const result = await loadSpec({
      kind: "env",
      varName: "OPENAPI_SPEC_MY_SOURCE",
    });
    expect(result).toEqual(spec);
  });

  it("rejects when env var is not set", async () => {
    await expect(
      loadSpec({ kind: "env", varName: "OPENAPI_SPEC_UNSET_VAR" })
    ).rejects.toThrow(/OPENAPI_SPEC_UNSET_VAR/);
  });
});

describe("loadSpec - local-override source", () => {
  it("reads file at the given path", async () => {
    const spec = { openapi: "3.0.0", paths: {} },
      p = writeSpec("override-spec.json", spec),
      result = await loadSpec({ kind: "local-override", path: p });
    expect(result).toEqual(spec);
  });
});

// ---------------------------------------------------------------------------
// ResolveSpecSource — priority order
// ---------------------------------------------------------------------------

describe("resolveSpecSource - priority", () => {
  it("--spec flag takes highest priority over everything", () => {
    const envSpecPath = writeSpec("env-spec.json", {}),
      snapshotPath = writeSpec("snapshot.json", {});
    vi.stubEnv("OPENAPI_SPEC_CORE_V2", envSpecPath);

    const source = resolveSpecSource("core-v2", {
      snapshotPath,
      specFlag: "/explicit/path.json",
    });
    expect(source).toEqual({ kind: "file", path: "/explicit/path.json" });
  });

  it("env var takes priority over local override and snapshot", () => {
    const envSpecPath = writeSpec("env-spec.json", {}),
      localPath = join(testDir, "openapi-codegen.local.json"),
      snapshotPath = writeSpec("snapshot.json", {});
    writeFileSync(localPath, JSON.stringify({ "core-v2": snapshotPath }));
    vi.stubEnv("OPENAPI_SPEC_CORE_V2", envSpecPath);

    const source = resolveSpecSource("core-v2", {
      localOverridePath: localPath,
      snapshotPath,
    });
    expect(source.kind).toBe("env");
    if (source.kind === "env") {
      expect(source.varName).toBe("OPENAPI_SPEC_CORE_V2");
    }
  });

  it("local override takes priority over snapshot", () => {
    const specPath = writeSpec("local-spec.json", {}),
      snapshotPath = writeSpec("snapshot.json", {}),
      localPath = join(testDir, "openapi-codegen.local.json");
    writeFileSync(localPath, JSON.stringify({ "core-v2": specPath }));

    const source = resolveSpecSource("core-v2", {
      localOverridePath: localPath,
      snapshotPath,
    });
    expect(source.kind).toBe("local-override");
    if (source.kind === "local-override") {
      expect(source.path).toBe(specPath);
    }
  });

  it("snapshot is used when no other source is available", () => {
    const snapshotPath = writeSpec("snapshot.json", {}),
      source = resolveSpecSource("core-v2", { snapshotPath });
    expect(source.kind).toBe("file");
    if (source.kind === "file") {
      expect(source.path).toBe(snapshotPath);
    }
  });

  it("local override file without entry for source key falls through to snapshot", () => {
    const localPath = join(testDir, "openapi-codegen.local.json"),
      snapshotPath = writeSpec("snapshot.json", {});
    // Local file exists but has different source key
    writeFileSync(
      localPath,
      JSON.stringify({ "other-source": "/some/path.json" })
    );

    const source = resolveSpecSource("core-v2", {
      localOverridePath: localPath,
      snapshotPath,
    });
    expect(source.kind).toBe("file");
  });

  it("normalises hyphens to underscores in env var name", () => {
    const envPath = writeSpec("spec.json", {});
    vi.stubEnv("OPENAPI_SPEC_ATLAS_V3", envPath);

    const source = resolveSpecSource("atlas-v3", {});
    expect(source.kind).toBe("env");
    if (source.kind === "env") {
      expect(source.varName).toBe("OPENAPI_SPEC_ATLAS_V3");
    }
  });
});

// ---------------------------------------------------------------------------
// ResolveSpecSource — error message
// ---------------------------------------------------------------------------

describe("resolveSpecSource - error when no spec found", () => {
  it("throws when nothing is found", () => {
    expect(() => resolveSpecSource("core-v2", {})).toThrow(
      'No OpenAPI spec found for source "core-v2"'
    );
  });

  it("first line is human-readable, not a stack trace", () => {
    try {
      resolveSpecSource("core-v2", {});
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error),
        firstLine = message.split("\n")[0]!;
      expect(firstLine).toContain("core-v2");
      expect(firstLine).not.toMatch(/^Error:/);
      expect(firstLine).not.toMatch(/^\s+at /);
    }
  });

  it("error message lists all tried resolution strategies", () => {
    try {
      resolveSpecSource("core-v2", {});
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).toContain("--spec flag");
      expect(message).toContain("OPENAPI_SPEC_CORE_V2");
      expect(message).toContain("openapi-codegen.local.json");
      expect(message).toContain("committed snapshot");
    }
  });

  it("error message includes diagnostic code and help", () => {
    try {
      resolveSpecSource("core-v2", {});
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).toContain("openapi-codegen/spec-not-found");
      expect(message).toContain("help:");
    }
  });

  it("error message includes fix commands", () => {
    try {
      resolveSpecSource("core-v2", {});
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).toContain("Fix:");
      expect(message).toContain("--source core-v2");
    }
  });

  it("ANSI codes are suppressed under NO_COLOR=1", () => {
    process.env["NO_COLOR"] = "1";
    try {
      resolveSpecSource("core-v2", {});
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error);
      expect(stripVTControlCharacters(message)).toBe(message);
    }
  });

  it("error includes snapshot path in message when provided but missing", () => {
    const missingSnapshot = join(testDir, "nonexistent", "spec.json");
    try {
      resolveSpecSource("core-v2", { snapshotPath: missingSnapshot });
      expect.fail("should have thrown");
    } catch (error) {
      const message = getErrorMessage(error);
      expect(message).toContain("nonexistent");
    }
  });
});
