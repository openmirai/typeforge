import { bold, cyan, dim, red, yellow } from "../color/index";
import type {
  EnvelopeFieldDiff,
  EnvelopeShape,
  OperationEnvelope,
} from "./index";

export function formatMixedEnvelopeError(
  sourceKey: string,
  groups: Map<string, Array<OperationEnvelope>>
): string {
  const header = bold(
    red(`openapi-codegen: mixed envelope shapes in source "${sourceKey}"`)
  );
  const lines = [header, ""];

  let index = 0;
  for (const [, operations] of groups.entries()) {
    index += 1;
    lines.push(
      bold(
        `Shape ${String.fromCharCode(64 + index)} — ${operations.length} operations`
      )
    );
    const sample = operations[0]?.shape.fields ?? [];
    for (const field of sample) {
      lines.push(`  ${field.name}${field.required ? "" : "?"}: ${field.kind}`);
    }
    lines.push("");
    for (const operation of operations.slice(0, 5)) {
      lines.push(dim(`  ${operation.method} ${operation.path}`));
    }
    if (operations.length > 5) {
      lines.push(dim(`  … and ${operations.length - 5} more`));
    }
    lines.push("");
  }

  lines.push(bold("Fix:"));
  lines.push("  • Narrow pathPrefix or add ignorePaths in source.ts");
  lines.push(
    cyan(`  • openapi-codegen generate --source ${sourceKey} --spec <path>`)
  );

  return lines.join("\n");
}

export function formatDriftError(
  sourceKey: string,
  spec: EnvelopeShape,
  userSource: string,
  userBlock: string,
  diffs: Array<EnvelopeFieldDiff>,
  outliers: Array<OperationEnvelope> = []
): string {
  const header = bold(
    red(`openapi-codegen: base response mismatch in source "${sourceKey}"`)
  );
  const lines = [header, ""];

  lines.push(bold("Spec envelope:"));
  for (const field of spec.fields) {
    lines.push(`  ${field.name}${field.required ? "" : "?"}: ${field.kind}`);
  }
  lines.push("");

  lines.push(bold(`Your ${userSource} BaseResponse:`));
  lines.push(userBlock);
  lines.push("");

  lines.push(bold("Conflicts:"));
  for (const diff of diffs) {
    if (diff.issue === "missing") {
      lines.push(
        yellow(`  • ${diff.field}: present in spec, missing in your type`)
      );
    } else if (diff.issue === "extra") {
      lines.push(yellow(`  • ${diff.field}: extra field in your type`));
    } else if (diff.issue === "type-changed") {
      lines.push(
        yellow(
          `  • ${diff.field}: spec is ${diff.spec?.kind}, your type is ${diff.user?.kind}`
        )
      );
    } else {
      lines.push(yellow(`  • ${diff.field}: required/optional mismatch`));
    }
  }

  if (outliers.length > 0) {
    lines.push("");
    lines.push(dim("Also not matching the spec envelope:"));
    for (const outlier of outliers.slice(0, 3)) {
      lines.push(dim(`  ${outlier.method} ${outlier.path}`));
    }
  }

  lines.push("");
  lines.push(bold("Fix:"));
  lines.push("  • Update models.ts to match the spec, or");
  lines.push(
    cyan(
      `  • openapi-codegen generate --source ${sourceKey} --spec <path> --accept-base`
    )
  );

  return lines.join("\n");
}
