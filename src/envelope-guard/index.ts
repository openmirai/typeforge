import type { IRSchema, IRSchemaProperty, IRSource } from "../parser/types";
import { resolveObjectSchema, resolveRef } from "../emitters/resolve-schema";
import { isSuccessStatusCode, schemaKindLabel } from "../utils/naming";

export type EnvelopeMode = "shared" | "raw" | "mixed";

export interface EnvelopeField {
  name: string;
  required: boolean;
  kind: string;
}

export interface EnvelopeShape {
  fields: Array<EnvelopeField>;
  schema: IRSchema;
}

export interface OperationEnvelope {
  method: string;
  path: string;
  shape: EnvelopeShape;
}

export interface EnvelopeAnalysis {
  mode: EnvelopeMode;
  shared?: EnvelopeShape;
  operations: Array<OperationEnvelope>;
  groups: Map<string, Array<OperationEnvelope>>;
}

export interface EnvelopeFieldDiff {
  field: string;
  issue: "missing" | "extra" | "type-changed" | "required-changed";
  spec?: EnvelopeField;
  user?: EnvelopeField;
}

export interface UserBaseResponseShape {
  fields: Array<EnvelopeField>;
  sourcePath: string;
}

function resolveSchema(
  schema: IRSchema,
  components: Record<string, IRSchema>
): IRSchema {
  if (schema.kind === "ref") {
    return resolveRef(schema, components);
  }
  return schema;
}

function extractEnvelopeShape(
  schema: IRSchema | undefined,
  components: Record<string, IRSchema>
): EnvelopeShape | undefined {
  if (schema === undefined) {
    return undefined;
  }

  const resolved = resolveObjectSchema(schema, components);
  if (resolved?.properties === undefined) {
    return undefined;
  }

  const fields: Array<EnvelopeField> = [];
  for (const [name, property] of Object.entries(resolved.properties)) {
    fields.push({
      kind:
        name === "data"
          ? "generic"
          : schemaKindLabel(resolveSchema(property.schema, components)),
      name,
      required: property.required,
    });
  }

  fields.sort((a, b) => a.name.localeCompare(b.name));
  return { fields, schema: resolved };
}

function fingerprint(shape: EnvelopeShape): string {
  return JSON.stringify(
    shape.fields.map((field) => ({
      kind: field.kind,
      name: field.name,
      required: field.required,
    }))
  );
}

export function matchesEnvelopeShape(
  schema: IRSchema,
  components: Record<string, IRSchema>,
  expected: EnvelopeShape
): boolean {
  const actual = extractEnvelopeShape(schema, components);
  return actual !== undefined && fingerprint(actual) === fingerprint(expected);
}

const ENVELOPE_METADATA_FIELDS = new Set([
  "error",
  "message",
  "requestId",
  "success",
  "timestamp",
]);

function looksLikeEnvelope(shape: EnvelopeShape): boolean {
  const names = new Set(shape.fields.map((field) => field.name));
  if (names.has("data")) {
    return true;
  }
  if (!names.has("success")) {
    return false;
  }
  return [...names].every((name) => ENVELOPE_METADATA_FIELDS.has(name));
}

export function isEnvelopeSchema(
  schema: IRSchema,
  components: Record<string, IRSchema>
): boolean {
  const shape = extractEnvelopeShape(schema, components);
  return shape !== undefined && looksLikeEnvelope(shape);
}

export function collectOperationEnvelopes(
  source: IRSource
): Array<OperationEnvelope> {
  const envelopes: Array<OperationEnvelope> = [];

  for (const pathItem of source.paths) {
    for (const operation of pathItem.operations) {
      const success = operation.responses.find(
        (response) =>
          isSuccessStatusCode(response.statusCode) &&
          response.schema !== undefined
      );
      if (success?.schema === undefined) {
        continue;
      }

      const shape = extractEnvelopeShape(
        success.schema,
        source.components.schemas
      );
      if (shape === undefined) {
        continue;
      }

      envelopes.push({
        method: operation.method.toUpperCase(),
        path: pathItem.path,
        shape,
      });
    }
  }

  return envelopes;
}

export function analyzeEnvelope(source: IRSource): EnvelopeAnalysis {
  const operations = collectOperationEnvelopes(source);
  const groups = new Map<string, Array<OperationEnvelope>>();

  for (const operation of operations) {
    const key = fingerprint(operation.shape);
    const existing = groups.get(key) ?? [];
    existing.push(operation);
    groups.set(key, existing);
  }

  if (operations.length === 0) {
    return { groups, mode: "raw", operations };
  }

  if (groups.size === 1) {
    const shared = operations[0]?.shape;
    if (shared !== undefined && looksLikeEnvelope(shared)) {
      return { groups, mode: "shared", operations, shared };
    }
    return { groups, mode: "raw", operations };
  }

  const envelopeGroups = [...groups.entries()].filter(([, items]) => {
    const first = items[0];
    return first !== undefined && looksLikeEnvelope(first.shape);
  });

  if (envelopeGroups.length === 0) {
    return { groups, mode: "raw", operations };
  }

  if (envelopeGroups.length === 1) {
    const group = envelopeGroups[0];
    const firstOperation = group?.[1][0];
    if (
      group !== undefined &&
      group[1].length === operations.length &&
      firstOperation !== undefined
    ) {
      return {
        groups,
        mode: "shared",
        operations,
        shared: firstOperation.shape,
      };
    }
  }

  return { groups, mode: "mixed", operations };
}

/** Largest envelope group that includes a `data` field; used for mixed-mode base.ts. */
export function getPrimaryEnvelopeShape(
  analysis: EnvelopeAnalysis
): EnvelopeShape | undefined {
  if (analysis.shared !== undefined) {
    return analysis.shared;
  }
  if (analysis.mode !== "mixed") {
    return undefined;
  }

  let best: EnvelopeShape | undefined;
  let bestCount = 0;
  for (const items of analysis.groups.values()) {
    const first = items[0];
    if (first === undefined || !looksLikeEnvelope(first.shape)) {
      continue;
    }
    if (!first.shape.fields.some((field) => field.name === "data")) {
      continue;
    }
    if (items.length > bestCount) {
      bestCount = items.length;
      best = first.shape;
    }
  }
  return best;
}

export function parseUserBaseResponse(
  content: string
): UserBaseResponseShape | undefined {
  const match = content.match(
    /export\s+interface\s+BaseResponse\s*<[^>]*>\s*\{([\s\S]*?)\}/
  );
  if (match === null) {
    const plain = content.match(
      /export\s+interface\s+BaseResponse\s*\{([\s\S]*?)\}/
    );
    if (plain === null) {
      return undefined;
    }
    return parseBaseResponseBody(plain[1]!);
  }

  return parseBaseResponseBody(match[1]!);
}

function parseBaseResponseBody(body: string): UserBaseResponseShape {
  const fields: Array<EnvelopeField> = [];
  const lineRegex = /^\s*(\w+)(\?)?:\s*([^;]+);/gm;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(body)) !== null) {
    const [, name, optional, rawType] = match;
    if (name === undefined || rawType === undefined) {
      continue;
    }
    fields.push({
      kind: rawType.trim().replace(/\s+/g, " "),
      name,
      required: optional === undefined,
    });
  }

  fields.sort((a, b) => a.name.localeCompare(b.name));
  return { fields, sourcePath: "models.ts" };
}

export function diffEnvelopeFields(
  spec: EnvelopeShape,
  user: UserBaseResponseShape
): Array<EnvelopeFieldDiff> {
  const diffs: Array<EnvelopeFieldDiff> = [];
  const specMap = new Map(
    spec.fields
      .filter((field) => field.name !== "data")
      .map((field) => [field.name, field])
  );
  const userMap = new Map(
    user.fields
      .filter((field) => field.name !== "data" && field.name !== "T")
      .map((field) => [field.name, field])
  );

  for (const [name, specField] of specMap.entries()) {
    const userField = userMap.get(name);
    if (userField === undefined) {
      diffs.push({ field: name, issue: "missing", spec: specField });
      continue;
    }
    if (specField.required !== userField.required) {
      diffs.push({
        field: name,
        issue: "required-changed",
        spec: specField,
        user: userField,
      });
    }
    if (specField.kind !== userField.kind && name !== "data") {
      diffs.push({
        field: name,
        issue: "type-changed",
        spec: specField,
        user: userField,
      });
    }
  }

  for (const [name, userField] of userMap.entries()) {
    if (!specMap.has(name)) {
      diffs.push({ field: name, issue: "extra", user: userField });
    }
  }

  return diffs;
}

export function getDataFieldSchema(shape: EnvelopeShape): IRSchema | undefined {
  const dataField = shape.schema.properties?.data;
  return dataField?.schema;
}

function formatEnvelopeFieldType(
  field: EnvelopeField,
  property: IRSchemaProperty | undefined,
  genericName: string
): string {
  if (property === undefined) {
    return "unknown";
  }
  if (field.kind === "generic") {
    return genericName;
  }
  return field.kind;
}

export function buildBaseResponseInterface(
  shape: EnvelopeShape,
  genericName = "T"
): string {
  const lines = [`export interface BaseResponse<${genericName}> {`];
  for (const field of shape.fields) {
    if (field.name === "data") {
      lines.push(`  data?: ${genericName};`);
      continue;
    }
    const optional = field.required ? "" : "?";
    const property = shape.schema.properties?.[field.name];
    const type = formatEnvelopeFieldType(field, property, genericName);
    lines.push(`  ${field.name}${optional}: ${type};`);
  }
  lines.push("}");
  return lines.join("\n");
}
