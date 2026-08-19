import type { HttpMethod, IRSchema } from "../parser/types";

export function pathToEnumName(routePath: string): string {
  return routePath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const withoutBraces = segment.replace(/[{}]/g, "");
      return withoutBraces.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase();
    })
    .join("_");
}

export function pathToRouteValue(
  routePath: string,
  stripApiPrefix = false
): string {
  const value = stripApiPrefix ? routePath.replace(/^\/api\//, "/") : routePath;
  return value.replace(/\{(\w+)\}/g, ":$1");
}

export function pathToFunctionName(
  cleanPath: string,
  method: HttpMethod
): string {
  const parts = cleanPath
    .split("/")
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[{[\]}/]/g, "")
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")
    );

  const resourceName = parts.join("");
  const action = method === "get" ? "get" : method;
  return `${action}${resourceName}`;
}

export function getFunctionFilePath(
  cleanPath: string,
  method: HttpMethod
): string {
  const normalizedPath = cleanPath
    .replace(/\{([^}]+)\}/g, "[$1]")
    .split("/")
    .filter(Boolean);
  return [...normalizedPath, `${method.toUpperCase()}.ts`].join("/");
}

export function getTypeFilePath(cleanPath: string, method: HttpMethod): string {
  const normalizedPath = cleanPath
    .replace(/\{([^}]+)\}/g, "[$1]")
    .split("/")
    .filter(Boolean);
  return [...normalizedPath, `${method.toUpperCase()}.d.ts`].join("/");
}

export function schemaKindLabel(schema: IRSchema): string {
  if (schema.kind === "array") {
    return "array";
  }
  if (schema.kind === "object") {
    return "object";
  }
  if (schema.kind === "ref") {
    return `ref:${schema.ref ?? "unknown"}`;
  }
  if (
    schema.kind === "oneOf" ||
    schema.kind === "anyOf" ||
    schema.kind === "allOf"
  ) {
    return schema.kind;
  }
  if (schema.enum !== undefined && schema.enum.length > 0) {
    return "enum";
  }
  return schema.kind;
}

export function isSuccessStatusCode(statusCode: string): boolean {
  const code = Number.parseInt(statusCode, 10);
  return !Number.isNaN(code) && code >= 200 && code < 300;
}
