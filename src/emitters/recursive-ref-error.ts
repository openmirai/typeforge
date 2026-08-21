import { bold, cyan, dim, red } from "../color/index";

export class RecursiveRefError extends Error {
  readonly cycle: Array<string>;
  readonly schemaPath: string;
  readonly sourceKey: string;

  constructor(sourceKey: string, cycle: Array<string>, schemaPath: string) {
    super(formatRecursiveRefError(sourceKey, cycle, schemaPath));
    this.name = "RecursiveRefError";
    this.cycle = cycle;
    this.schemaPath = schemaPath;
    this.sourceKey = sourceKey;
  }
}

export function formatRecursiveRefError(
  sourceKey: string,
  cycle: Array<string>,
  schemaPath: string
): string {
  const lines = [
    bold(red(`typeforge: recursive schema reference in source "${sourceKey}"`)),
    "",
    bold("Cycle:"),
    `  ${cycle.join(" → ")}`,
    "",
    bold("At:"),
    dim(`  ${schemaPath}`),
    "",
    bold("Fix:"),
    "  • Add a known-type override in known-types.ts for this shape, or",
    "  • Simplify the OpenAPI schema to remove the circular reference",
    cyan(`  • typeforge generate --source ${sourceKey} --spec <path>`),
  ];
  return lines.join("\n");
}
