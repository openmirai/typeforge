import { bold, cyan, dim, red, white, yellow } from "./index";

export interface DiagnosticSnippet {
  column: number;
  file: string;
  highlightEnd: number;
  highlightStart: number;
  label?: string;
  line: number;
  source: string;
}

export interface DiagnosticOptions {
  code: string;
  help?: string;
  message: string;
  severity?: "error" | "warning";
  snippet?: DiagnosticSnippet;
}

function formatCaretLine(
  column: number,
  highlightStart: number,
  highlightEnd: number,
  label?: string
): string {
  const caretPrefix = " ".repeat(column + 1);
  const caretBody = `${" ".repeat(Math.max(highlightEnd - highlightStart, 1))}|`;
  const caret = `${caretPrefix}:${caretBody}`;
  if (label === undefined) {
    return caret;
  }
  const labelPrefix = " ".repeat(column + highlightEnd + 3);
  return `${caret}\n${labelPrefix}\`${dim(`-- ${label}`)}`;
}

function formatSnippet(snippet: DiagnosticSnippet): string {
  const header = dim(
    `    ,-[${snippet.file}:${snippet.line}:${snippet.column}]`
  );
  const source = white(
    `${String(snippet.line).padStart(4, " ")} | ${snippet.source}`
  );
  const caret = formatCaretLine(
    4 + " | ".length + snippet.highlightStart,
    snippet.highlightStart,
    snippet.highlightEnd,
    snippet.label
  );
  const footer = dim("    `----");
  return [header, source, caret, footer].join("\n");
}

export function formatDiagnostic(options: DiagnosticOptions): string {
  const severity = options.severity ?? "error";
  const icon = severity === "error" ? red("×") : yellow("!");
  const lines = [`  ${icon} ${bold(`${options.code}`)}: ${options.message}`];

  if (options.snippet !== undefined) {
    lines.push(formatSnippet(options.snippet));
  }

  if (options.help !== undefined) {
    lines.push(`  ${dim("help:")} ${options.help}`);
  }

  return lines.join("\n");
}

export function formatHelpList(title: string, items: Array<string>): string {
  return [bold(title), ...items.map((item) => `  ${cyan(item)}`)].join("\n");
}
