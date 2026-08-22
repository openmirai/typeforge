import type { JsonObject, JsonValue } from "../json/types";
import { isJsonObject } from "../json/types";
import type { IRSchema } from "../parser/types";
import { parseSchema } from "../parser/index";
import { RecursiveRefError } from "./recursive-ref-error";
import { refNameFromSchema, resolveRef } from "./resolve-schema";
import { matchKnownType } from "../plugins/known-types/index";
import type { KnownTypeRule } from "../plugins/known-types/index";
import { renderTypeDoc } from "./tsdoc";
import type { TypeDoc } from "./tsdoc";

export interface SchemaRenderContext {
  components: Record<string, IRSchema>;
  knownTypes?: Array<KnownTypeRule>;
  knownTypeImports?: Map<string, string | null>;
  visitedRefs?: Set<string>;
  refStack?: Array<string>;
  schemaPath?: string;
  sourceKey?: string;
  rawSpec?: JsonObject;
  maxDepth?: number;
  depth?: number;
  resolveMapKeyRefs?: boolean;
}

const DEFAULT_MAX_DEPTH = 50;

function indent(level: number): string {
  return "  ".repeat(level);
}

function formatEnumLiteral(value: string | number | boolean | null): string {
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) {
    return "null";
  }
  return "unknown";
}

function formatEnumUnion(
  enumValues: Array<string | number | boolean | null>
): string {
  return [...new Set(enumValues.map(formatEnumLiteral))].join(" | ");
}

function withNullable(type: string, schema: IRSchema): string {
  if (schema.nullable === true) {
    return `${type} | null`;
  }
  return type;
}

function decodeJsonPointerSegment(segment: string): string {
  return decodeURIComponent(segment.replace(/~1/g, "/").replace(/~0/g, "~"));
}

function readJsonPointerValue(
  value: JsonValue,
  segment: string
): JsonValue | undefined {
  if (Array.isArray(value)) {
    const index = Number(segment);
    if (!Number.isInteger(index) || index < 0 || index >= value.length) {
      return undefined;
    }
    return value[index];
  }
  if (isJsonObject(value) && segment in value) {
    return value[segment];
  }
  return undefined;
}

function resolveOpenApiPointer(
  spec: JsonObject,
  pointer: string
): IRSchema | undefined {
  if (!pointer.startsWith("#/")) {
    return undefined;
  }

  let value: JsonValue | undefined = spec;
  for (const part of pointer
    .slice(2)
    .split("/")
    .map(decodeJsonPointerSegment)) {
    value = value === undefined ? undefined : readJsonPointerValue(value, part);
    if (value === undefined) {
      return undefined;
    }
  }

  return parseSchema(value);
}

function getMapKeyType(schema: IRSchema, ctx: SchemaRenderContext): string {
  const keyRef = schema["x-map-key-ref"];
  if (keyRef === undefined) {
    return "string";
  }

  if (ctx.rawSpec !== undefined) {
    const referenced = resolveOpenApiPointer(ctx.rawSpec, keyRef);
    if (referenced !== undefined) {
      return renderSchemaType(referenced, {
        ...ctx,
        depth: (ctx.depth ?? 0) + 1,
      });
    }
  }

  const refName = keyRef.split("/").pop();
  if (refName !== undefined && ctx.components[refName] !== undefined) {
    return renderSchemaType(ctx.components[refName]!, {
      ...ctx,
      depth: (ctx.depth ?? 0) + 1,
    });
  }

  return "string";
}

function throwRecursiveError(ctx: SchemaRenderContext, refName: string): never {
  const stack = ctx.refStack ?? [];
  const cycle = [...stack, refName];
  throw new RecursiveRefError(
    ctx.sourceKey ?? "unknown",
    cycle,
    ctx.schemaPath ?? refName
  );
}

function childContext(
  ctx: SchemaRenderContext,
  segment: string
): SchemaRenderContext {
  const basePath = ctx.schemaPath ?? "schema";
  return {
    ...ctx,
    schemaPath: `${basePath}.${segment}`,
  };
}

/** Resolve documentation attached directly to a schema or inherited from a ref. */
export function getSchemaTypeDoc(
  schema: IRSchema,
  components: Record<string, IRSchema>
): TypeDoc {
  const documentation: TypeDoc = {};
  const visitedRefs = new Set<string>();
  let current: IRSchema | undefined = schema;

  while (current !== undefined) {
    if (
      documentation.description === undefined &&
      current.description?.trim().length
    ) {
      documentation.description = current.description;
    }
    if (current.deprecated === true) {
      documentation.deprecated = true;
    }

    if (
      current.kind !== "ref" ||
      current.ref === undefined ||
      visitedRefs.has(current.ref)
    ) {
      break;
    }
    visitedRefs.add(current.ref);
    current = components[current.ref];
  }

  return documentation;
}

export function renderSchemaType(
  schema: IRSchema,
  ctx: SchemaRenderContext
): string {
  const depth = ctx.depth ?? 0;
  const maxDepth = ctx.maxDepth ?? DEFAULT_MAX_DEPTH;
  if (depth > maxDepth) {
    throw new RecursiveRefError(
      ctx.sourceKey ?? "unknown",
      ctx.refStack ?? [],
      `${ctx.schemaPath ?? "schema"} (max depth ${maxDepth} exceeded)`
    );
  }

  const nextCtx: SchemaRenderContext = {
    ...ctx,
    depth: depth + 1,
  };

  const knownRules = ctx.knownTypes ?? [];
  if (knownRules.length > 0) {
    const known = matchKnownType(schema, ctx.components, knownRules);
    if (known !== undefined) {
      if (
        ctx.knownTypeImports !== undefined &&
        !ctx.knownTypeImports.has(known.typeName)
      ) {
        ctx.knownTypeImports.set(known.typeName, known.importPath);
      }
      return withNullable(known.typeName, schema);
    }
  }

  if (schema.enum !== undefined && schema.enum.length > 0) {
    return withNullable(formatEnumUnion(schema.enum), schema);
  }

  if (schema.kind === "ref") {
    const refName = refNameFromSchema(schema);
    if (refName === undefined) {
      return "unknown";
    }

    const visited = ctx.visitedRefs ?? new Set<string>();
    const refStack = ctx.refStack ?? [];

    if (visited.has(refName)) {
      throwRecursiveError(ctx, refName);
    }

    const resolved = resolveRef(schema, ctx.components);
    const refCtx: SchemaRenderContext = {
      ...nextCtx,
      refStack: [...refStack, refName],
      visitedRefs: new Set([...visited, refName]),
    };
    return renderSchemaType(resolved, refCtx);
  }

  switch (schema.kind) {
    case "string":
      return withNullable("string", schema);
    case "number":
      return withNullable("number", schema);
    case "boolean":
      return withNullable("boolean", schema);
    case "null":
      return "null";
    case "unknown":
      return "unknown";
    case "array": {
      const itemType =
        schema.items === undefined
          ? "unknown"
          : renderSchemaType(schema.items, childContext(nextCtx, "[]"));
      if (itemType === "TiptapDocument") {
        return withNullable("TiptapDocument", schema);
      }
      return withNullable(
        `${itemType.includes(" | ") ? `(${itemType})` : itemType}[]`,
        schema
      );
    }
    case "object": {
      if (schema.properties === undefined) {
        if (schema.additionalProperties === true) {
          return withNullable("Record<string, unknown>", schema);
        }
        if (
          typeof schema.additionalProperties === "object" &&
          schema.additionalProperties !== null
        ) {
          const keyType =
            ctx.resolveMapKeyRefs !== false &&
            schema["x-map-key-ref"] !== undefined
              ? getMapKeyType(schema, ctx)
              : "string";
          const valueType = renderSchemaType(
            schema.additionalProperties,
            childContext(nextCtx, "value")
          );
          return withNullable(`Record<${keyType}, ${valueType}>`, schema);
        }
        return withNullable("Record<string, unknown>", schema);
      }

      const lines: Array<string> = ["{"];
      for (const [name, property] of Object.entries(schema.properties)) {
        const optional = property.required ? "" : "?";
        const type = renderSchemaType(
          property.schema,
          childContext(nextCtx, name)
        );
        lines.push(
          ...renderTypeDoc(
            getSchemaTypeDoc(property.schema, ctx.components),
            indent(depth + 1)
          )
        );
        lines.push(`${indent(depth + 1)}${name}${optional}: ${type};`);
      }
      lines.push(`${indent(depth)}}`);
      return withNullable(lines.join("\n"), schema);
    }
    case "oneOf":
    case "anyOf": {
      const variants = schema[schema.kind];
      if (variants === undefined || variants.length === 0) {
        return "unknown";
      }

      const renderedVariants = variants.map((variant) =>
        renderSchemaType(variant, nextCtx)
      );
      const specificVariants = renderedVariants.filter(
        (variant) => variant !== "Record<string, unknown>"
      );
      return withNullable(
        (specificVariants.length > 0
          ? specificVariants
          : renderedVariants
        ).join(" | "),
        schema
      );
    }
    case "allOf": {
      const parts = schema.allOf;
      if (parts === undefined || parts.length === 0) {
        return "unknown";
      }
      return withNullable(
        parts.map((part) => renderSchemaType(part, nextCtx)).join(" & "),
        schema
      );
    }
    default:
      return "unknown";
  }
}

export { resolveRef } from "./resolve-schema";
