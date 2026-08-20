import { existsSync, readFileSync } from "node:fs";
import { dirname, parse, resolve } from "node:path";

export interface TsconfigPathsConfig {
  /** Absolute directory containing tsconfig.json. */
  baseDir: string;
  /** Resolved baseUrl (absolute path). */
  resolvedBaseUrl: string;
  /** Raw paths map from compilerOptions.paths. */
  paths: Record<string, Array<string>>;
}

/**
 * Strip line comments (//) and block comments from a JSON string, and
 * remove trailing commas before closing braces/brackets.
 * Handles tsconfig.json / jsonc format.
 */
function stripJsonComments(text: string): string {
  let result = "";
  let i = 0;
  const len = text.length;
  let inString = false;

  while (i < len) {
    const ch = text[i];

    if (inString) {
      result += ch;
      if (ch === "\\") {
        i++;
        if (i < len) {
          result += text[i];
        }
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      i++;
      continue;
    }

    // Line comment
    if (ch === "/" && text[i + 1] === "/") {
      while (i < len && text[i] !== "\n") {
        i++;
      }
      continue;
    }

    // Block comment
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < len && !(text[i] === "*" && text[i + 1] === "/")) {
        i++;
      }
      i += 2;
      continue;
    }

    result += ch;
    i++;
  }

  // Remove trailing commas before } or ]
  return result.replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Load `compilerOptions.paths` and `baseUrl` from the nearest `tsconfig.json`
 * found at or above `startDir`. Returns `undefined` when no tsconfig has paths.
 */
export function loadTsconfigPaths(
  startDir: string
): TsconfigPathsConfig | undefined {
  let currentDir = resolve(startDir);
  const rootDir = parse(currentDir).root;

  while (true) {
    const config = readTsconfigPaths(currentDir);
    if (config !== undefined) {
      return config;
    }

    if (currentDir === rootDir) {
      return undefined;
    }
    currentDir = dirname(currentDir);
  }
}

function readTsconfigPaths(configDir: string): TsconfigPathsConfig | undefined {
  const tsconfigPath = resolve(configDir, "tsconfig.json");
  if (!existsSync(tsconfigPath)) {
    return undefined;
  }

  try {
    const raw = JSON.parse(
      stripJsonComments(readFileSync(tsconfigPath, "utf8"))
    ) as unknown;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return undefined;
    }

    const opts = (raw as Record<string, unknown>)["compilerOptions"];
    if (typeof opts !== "object" || opts === null || Array.isArray(opts)) {
      return undefined;
    }

    const compilerOptions = opts as Record<string, unknown>;
    const rawPaths = compilerOptions["paths"];
    if (
      typeof rawPaths !== "object" ||
      rawPaths === null ||
      Array.isArray(rawPaths)
    ) {
      return undefined;
    }

    const baseUrl =
      typeof compilerOptions["baseUrl"] === "string"
        ? compilerOptions["baseUrl"]
        : ".";

    const normalizedPaths: Record<string, Array<string>> = {};
    for (const [key, value] of Object.entries(
      rawPaths as Record<string, unknown>
    )) {
      if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
        normalizedPaths[key] = value as Array<string>;
      }
    }

    if (Object.keys(normalizedPaths).length === 0) {
      return undefined;
    }

    return {
      baseDir: configDir,
      paths: normalizedPaths,
      resolvedBaseUrl: resolve(configDir, baseUrl),
    };
  } catch {
    return undefined;
  }
}

/**
 * Try to find a tsconfig path alias for `absoluteTarget`.
 *
 * Returns the alias import string (e.g. `@mirai/utils/api/v2/generated/runtime`)
 * when a match is found, or `undefined` when no alias covers the target.
 *
 * Supports:
 * - Wildcard patterns: `"@foo/*"` → `["packages/foo/src/*"]`
 * - Exact patterns: `"@foo/bar"` → `["packages/foo/src/bar"]`
 */
export function resolveAliasImport(
  absoluteTarget: string,
  config: TsconfigPathsConfig
): string | undefined {
  for (const [alias, mappings] of Object.entries(config.paths)) {
    for (const mapping of mappings) {
      if (alias.endsWith("/*") && mapping.endsWith("/*")) {
        const aliasBase = alias.slice(0, -2);
        const mappingBase = mapping.slice(0, -2);
        const resolvedBase = resolve(config.resolvedBaseUrl, mappingBase);

        if (absoluteTarget.startsWith(`${resolvedBase}/`)) {
          const suffix = absoluteTarget.slice(resolvedBase.length + 1);
          return `${aliasBase}/${suffix}`;
        }
        if (absoluteTarget === resolvedBase) {
          return aliasBase;
        }
      } else if (!alias.includes("*") && !mapping.includes("*")) {
        const resolvedMapping = resolve(config.resolvedBaseUrl, mapping);
        if (
          stripTsExtension(absoluteTarget) === stripTsExtension(resolvedMapping)
        ) {
          return alias;
        }
      }
    }
  }
  return undefined;
}

function stripTsExtension(p: string): string {
  return p.replace(/\.(d\.ts|ts|js)$/, "");
}
