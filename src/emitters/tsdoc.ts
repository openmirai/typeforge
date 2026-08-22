export interface TypeDoc {
  description?: string;
  deprecated?: boolean;
}

function sanitizeDescription(description: string): Array<string> {
  return description
    .trim()
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll("*/", "*\\/")
    .split("\n");
}

/** Render OpenAPI documentation as a safe TypeScript doc comment. */
export function renderTypeDoc(
  documentation: TypeDoc,
  indentation = ""
): Array<string> {
  const descriptionLines =
    documentation.description === undefined
      ? []
      : sanitizeDescription(documentation.description);
  const hasDescription = descriptionLines.some((line) => line.length > 0);
  const deprecated = documentation.deprecated === true;

  if (!hasDescription && !deprecated) {
    return [];
  }

  if (descriptionLines.length === 1 && !deprecated) {
    return [`${indentation}/** ${descriptionLines[0]} */`];
  }

  const lines = [`${indentation}/**`];
  if (hasDescription) {
    for (const line of descriptionLines) {
      lines.push(`${indentation} *${line.length > 0 ? ` ${line}` : ""}`);
    }
  }
  if (deprecated) {
    if (hasDescription) {
      lines.push(`${indentation} *`);
    }
    lines.push(`${indentation} * @deprecated`);
  }
  lines.push(`${indentation} */`);
  return lines;
}
