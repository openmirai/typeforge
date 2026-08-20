import { dirname, join, relative } from "node:path";

import type { TsconfigPathsConfig } from "./tsconfig-paths";
import { resolveAliasImport } from "./tsconfig-paths";

function stripTypeScriptExtension(filePath: string): string {
  return filePath.replace(/\.d\.ts$/, "").replace(/\.ts$/, "");
}

export function relativeImportPath(
  fromFilePath: string,
  toPathWithoutExtension: string
): string {
  const fromDir = dirname(stripTypeScriptExtension(fromFilePath));
  const toPath = stripTypeScriptExtension(toPathWithoutExtension);
  const rel = relative(fromDir, toPath).replace(/\\/g, "/");
  if (rel.startsWith(".")) {
    return rel;
  }
  return `./${rel}`;
}

/** Import path from a generated function file to a sibling under `generated/`. */
export function relativeImportFromFunctionFile(
  cleanPath: string,
  targetRelativeToGenerated: string
): string {
  const depth = cleanPath.split("/").filter(Boolean).length + 1;
  return `${"../".repeat(depth)}${targetRelativeToGenerated}`;
}

/**
 * Minimum number of `../` segments before we prefer an alias import over a
 * relative one.  Paths with fewer segments are already concise.
 */
const MIN_DOTDOT_FOR_ALIAS = 3;

export interface AliasAwareImportOptions {
  /** Absolute path of the generated file that contains the import statement. */
  fromAbsolutePath: string;
  /** Absolute path of the import target (no extension). */
  toAbsolutePath: string;
  /**
   * When set, overrides auto-resolution.  The import becomes
   * `${importBase}/<suffix-relative-to-generatedDir>`.
   */
  importBase?: string;
  /** Absolute path of the `generated/` directory. Used with `importBase`. */
  generatedDir?: string;
  /** Loaded tsconfig paths config for alias auto-detection. */
  tsconfigPaths?: TsconfigPathsConfig;
}

/**
 * Resolve the best import path from `fromAbsolutePath` to `toAbsolutePath`.
 *
 * Resolution priority:
 * 1. `importBase` explicit override (e.g. `@mirai/utils/src/api/v2/generated`)
 * 2. tsconfig path alias auto-detection (when relative has ≥3 `../` segments)
 * 3. Relative fallback
 */
export function resolveAliasAwareImport(
  options: AliasAwareImportOptions
): string {
  const {
    fromAbsolutePath,
    toAbsolutePath,
    importBase,
    generatedDir,
    tsconfigPaths,
  } = options;

  // 1. Explicit importBase override
  if (importBase !== undefined && generatedDir !== undefined) {
    const strippedGenDir = generatedDir.replace(/\/$/, "");
    const strippedTarget = stripTypeScriptExtension(toAbsolutePath);
    if (strippedTarget.startsWith(`${strippedGenDir}/`)) {
      const suffix = strippedTarget.slice(strippedGenDir.length + 1);
      return `${importBase}/${suffix}`;
    }
    if (strippedTarget === strippedGenDir) {
      return importBase;
    }
  }

  const rel = relativeImportPath(fromAbsolutePath, toAbsolutePath);

  // 2. Tsconfig alias auto-detection (only for deep relative paths)
  if (tsconfigPaths !== undefined) {
    const dotdotCount = (rel.match(/\.\.\//g) ?? []).length;
    if (dotdotCount >= MIN_DOTDOT_FOR_ALIAS) {
      const aliasImport = resolveAliasImport(toAbsolutePath, tsconfigPaths);
      if (aliasImport !== undefined) {
        return aliasImport;
      }
    }
  }

  // 3. Relative fallback
  return rel;
}

/**
 * Compute the absolute path of a generated function file.
 *
 * @param functionsDir - absolute path to the `functions/` directory
 * @param cleanPath    - path segment like `api/v2/auth/email/validate`
 * @param method       - HTTP method in uppercase, e.g. `GET`
 */
export function functionFileAbsPath(
  functionsDir: string,
  cleanPath: string,
  method: string
): string {
  return join(functionsDir, cleanPath, `${method}.ts`);
}
