import { dirname, relative } from "node:path";

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
