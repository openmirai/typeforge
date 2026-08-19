import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatDiagnostic, formatHelpList } from "../color/diagnostic";
import { bold, dim } from "../color/index";
import type { JsonValue } from "../json/types";
import { parseJson, readJsonObject } from "../json/types";

export type SpecSource =
  | { kind: "file"; path: string }
  | { kind: "env"; varName: string }
  | { kind: "local-override"; path: string };

export async function loadSpec(source: SpecSource): Promise<JsonValue> {
  let filePath: string;

  switch (source.kind) {
    case "file": {
      filePath = resolve(source.path);
      break;
    }
    case "local-override": {
      filePath = resolve(source.path);
      break;
    }
    case "env": {
      const envValue = process.env[source.varName];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${source.varName} is not set`);
      }
      filePath = resolve(envValue);
      break;
    }
  }

  const content = await readFile(filePath, "utf8");
  return parseJson(content);
}

/**
 * Resolution priority:
 *   1. --spec CLI flag
 *   2. OPENAPI_SPEC_<UPPER_KEY> env var
 *   3. openapi-codegen.local.json (gitignored per-machine override)
 *   4. committed snapshot at snapshotPath
 *
 * Throws a human-readable error (no stack trace as first line) when nothing is found.
 */
export function resolveSpecSource(
  sourceKey: string,
  opts: {
    specFlag?: string;
    localOverridePath?: string;
    snapshotPath?: string;
  }
): SpecSource {
  // 1. --spec flag
  if (opts.specFlag !== undefined) {
    return { kind: "file", path: opts.specFlag };
  }

  // 2. Env var
  const envVarName = `OPENAPI_SPEC_${sourceKey.toUpperCase().replace(/-/g, "_")}`,
    envValue = process.env[envVarName];
  if (envValue !== undefined) {
    return { kind: "env", varName: envVarName };
  }

  // 3. Local override file
  const localPath = opts.localOverridePath ?? "./openapi-codegen.local.json";
  if (existsSync(localPath)) {
    try {
      const localData = readJsonObject(readFileSync(localPath, "utf8")),
        specPath = localData[sourceKey];
      if (typeof specPath === "string") {
        return { kind: "local-override", path: specPath };
      }
    } catch {
      // Malformed local override — fall through
    }
  }

  // 4. Committed snapshot
  if (opts.snapshotPath !== undefined && existsSync(opts.snapshotPath)) {
    return { kind: "file", path: opts.snapshotPath };
  }

  // Nothing found — build a human-readable error
  throw new Error(buildNotFoundMessage(sourceKey, envVarName, opts, localPath));
}

function formatSnapshotNote(snapshotPath: string | undefined): string {
  if (snapshotPath === undefined) {
    return dim("not configured");
  }
  if (existsSync(snapshotPath)) {
    return dim(`found at ${snapshotPath}`);
  }
  return dim(`not found at ${snapshotPath}`);
}

function buildNotFoundMessage(
  sourceKey: string,
  envVarName: string,
  opts: {
    specFlag?: string;
    localOverridePath?: string;
    snapshotPath?: string;
  },
  localPath: string
): string {
  const specFlagNote =
      opts.specFlag !== undefined ? opts.specFlag : dim("not provided"),
    envNote = dim("not set"),
    localExists = existsSync(localPath),
    localNote = localExists
      ? dim(`found at ${localPath} (no entry for "${sourceKey}")`)
      : dim(`not found at ${localPath}`),
    { snapshotPath } = opts;
  const snapshotNote = formatSnapshotNote(snapshotPath),
    tried = [
      `  --spec flag:                ${specFlagNote}`,
      `  ${envVarName} env:   ${envNote}`,
      `  openapi-codegen.local.json: ${localNote}`,
      `  committed snapshot:         ${snapshotNote}`,
    ].join("\n"),
    fixCommands = [
      `openapi-codegen generate --source ${sourceKey} --spec ./path/to/swagger.json`,
      `export ${envVarName}=./path/to/swagger.json`,
    ];

  const diagnostic = formatDiagnostic({
    code: "openapi-codegen/spec-not-found",
    help: "Provide one of the resolution paths above, for example with --spec or an env var.",
    message: `No OpenAPI spec found for source "${sourceKey}"`,
    severity: "error",
  });

  return [
    diagnostic,
    "",
    bold("Tried:"),
    tried,
    "",
    formatHelpList("Fix:", fixCommands),
  ].join("\n");
}
