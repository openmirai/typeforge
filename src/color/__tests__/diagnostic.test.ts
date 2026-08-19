import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { formatDiagnostic } from "../diagnostic";

function enableTTY(): void {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: true,
    writable: true,
  });
}

function disableTTY(): void {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: undefined,
    writable: true,
  });
}

describe("formatDiagnostic", () => {
  beforeEach(() => {
    delete process.env["NO_COLOR"];
    enableTTY();
  });

  afterEach(() => {
    disableTTY();
    delete process.env["NO_COLOR"];
  });

  it("formats an error with code, message, and help like oxlint", () => {
    const output = formatDiagnostic({
      code: "openapi-codegen/spec-not-found",
      help: "Provide --spec or set OPENAPI_SPEC_CORE_V2.",
      message: 'No OpenAPI spec found for source "core-v2"',
    });

    const plain = stripVTControlCharacters(output);
    expect(plain).toContain("openapi-codegen/spec-not-found");
    expect(plain).toContain('No OpenAPI spec found for source "core-v2"');
    expect(plain).toContain("help:");
    expect(plain).toContain("Provide --spec or set OPENAPI_SPEC_CORE_V2.");
  });

  it("formats a snippet with file location and caret", () => {
    const output = formatDiagnostic({
      code: "openapi-codegen/base-response-drift",
      help: "Update models.ts or run with --accept-base.",
      message: "BaseResponse does not match the OpenAPI envelope",
      snippet: {
        column: 1,
        file: "src/api/models.ts",
        highlightEnd: 12,
        highlightStart: 0,
        label: "type changed (object → string)",
        line: 14,
        source: "  error?: string;",
      },
    });

    const plain = stripVTControlCharacters(output);
    expect(plain).toContain("src/api/models.ts:14:1");
    expect(plain).toContain("error?: string;");
    expect(plain).toContain("type changed (object → string)");
  });

  it("suppresses ANSI codes under NO_COLOR", () => {
    process.env["NO_COLOR"] = "1";
    const output = formatDiagnostic({
      code: "openapi-codegen/spec-not-found",
      message: "missing spec",
    });
    expect(output).toBe(output.replaceAll("\u001b", ""));
  });
});
