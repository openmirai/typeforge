import { buildBaseResponseInterface } from "../../envelope-guard/index";
import type { EnvelopeMode, EnvelopeShape } from "../../envelope-guard/index";
import type { QueryExtendsConfig } from "../../config/types";
import { DEFAULT_MAX_RENDER_DEPTH } from "../../config/types";
import type { JsonObject } from "../../json/types";
import type { KnownTypeRule } from "../../plugins/known-types/index";
import type { IROperation, IRQueryParam, IRSource } from "../../parser/types";
import { relativeImportPath } from "../../utils/imports";
import { renderSchemaType } from "../schema-renderer";
import type { SchemaRenderContext } from "../schema-renderer";
import { resolveRef } from "../resolve-schema";
import {
  getFunctionTypeName,
  getSuccessResponseSchema,
  hasMeaningfulRequestBody,
} from "../../utils/type-names";

export interface TypesEmitterOptions {
  source: IRSource;
  envelopeMode: EnvelopeMode;
  sharedEnvelope?: EnvelopeShape;
  knownTypes?: Array<KnownTypeRule>;
  rawSpec?: JsonObject;
  sourceKey?: string;
  queryExtends?: QueryExtendsConfig;
  maxRenderDepth?: number;
  resolveMapKeyRefs?: boolean;
  typesDir: string;
  baseFile: string;
}

function createRenderContext(
  options: TypesEmitterOptions,
  schemaPath: string,
  knownTypeImports: Map<string, string | null>
): SchemaRenderContext {
  const ctx: SchemaRenderContext = {
    components: options.source.components.schemas,
    knownTypeImports,
    knownTypes: options.knownTypes ?? [],
    maxDepth: options.maxRenderDepth ?? DEFAULT_MAX_RENDER_DEPTH,
    resolveMapKeyRefs: options.resolveMapKeyRefs !== false,
    schemaPath,
  };
  if (options.sourceKey !== undefined) {
    ctx.sourceKey = options.sourceKey;
  }
  if (options.rawSpec !== undefined) {
    ctx.rawSpec = options.rawSpec;
  }
  return ctx;
}

function formatImportLines(
  knownTypeImports: Map<string, string | null>
): Array<string> {
  const lines: Array<string> = [];
  const byPath = new Map<string | null, Array<string>>();

  for (const [typeName, importPath] of knownTypeImports.entries()) {
    const existing = byPath.get(importPath) ?? [];
    existing.push(typeName);
    byPath.set(importPath, existing);
  }

  for (const [importPath, typeNames] of byPath.entries()) {
    if (importPath === null) {
      continue;
    }
    lines.push(`import type { ${typeNames.join(", ")} } from "${importPath}";`);
  }

  return lines;
}

function renderParamsInterface(
  typeName: string,
  operation: IROperation,
  options: TypesEmitterOptions,
  knownTypeImports: Map<string, string | null>
): string | undefined {
  if (operation.queryParams.length === 0) {
    return undefined;
  }

  const queryExtends = options.queryExtends;
  const pageName = queryExtends?.page ?? "page";
  const limitName = queryExtends?.limit ?? "limit";
  const sortByName = queryExtends?.sortBy ?? "sortBy";
  const sortOrderName = queryExtends?.sortOrder ?? "sortOrder";

  const hasPage = operation.queryParams.some(
    (param) => param.name === pageName
  );
  const hasLimit = operation.queryParams.some(
    (param) => param.name === limitName
  );
  const sortByParam = operation.queryParams.find(
    (param) => param.name === sortByName
  );
  const hasSortOrder = operation.queryParams.some(
    (param) => param.name === sortOrderName
  );

  const hasOffsetLimitQuery = hasPage && hasLimit;
  const hasSortParams = sortByParam !== undefined && hasSortOrder;

  const commonParamNames = new Set<string>(
    [
      hasOffsetLimitQuery ? pageName : undefined,
      hasOffsetLimitQuery ? limitName : undefined,
      hasSortParams ? sortByName : undefined,
      hasSortParams ? sortOrderName : undefined,
    ].filter((name): name is string => name !== undefined)
  );

  const nonCommonParams = operation.queryParams.filter(
    (param) => !commonParamNames.has(param.name)
  );

  const extendsParts: Array<string> = [];
  if (
    hasSortParams &&
    sortByParam !== undefined &&
    sortByParam.schema.enum !== undefined &&
    sortByParam.schema.enum.length > 0 &&
    queryExtends?.sortTypeName !== undefined
  ) {
    const sortOptions = [
      ...new Set(sortByParam.schema.enum.map((value) => JSON.stringify(value))),
    ].join(" | ");
    extendsParts.push(`${queryExtends.sortTypeName}<${sortOptions}>`);
    if (queryExtends.sortImportPath !== undefined) {
      knownTypeImports.set(
        queryExtends.sortTypeName,
        queryExtends.sortImportPath
      );
    }
  }
  if (hasOffsetLimitQuery && queryExtends?.paginationTypeName !== undefined) {
    extendsParts.push(queryExtends.paginationTypeName);
    if (queryExtends.paginationImportPath !== undefined) {
      knownTypeImports.set(
        queryExtends.paginationTypeName,
        queryExtends.paginationImportPath
      );
    }
  }

  if (extendsParts.length > 0 && nonCommonParams.length === 0) {
    return `export type ${typeName}Params = ${extendsParts.join(" & ")};`;
  }

  const lines: Array<string> = [];
  if (extendsParts.length > 0) {
    lines.push(
      `export interface ${typeName}Params extends ${extendsParts.join(", ")} {`
    );
  } else {
    lines.push(`export interface ${typeName}Params {`);
  }

  for (const param of nonCommonParams) {
    appendQueryParam(param, lines, options, knownTypeImports, typeName);
  }

  lines.push("}");
  return lines.join("\n");
}

function appendQueryParam(
  param: IRQueryParam,
  lines: Array<string>,
  options: TypesEmitterOptions,
  knownTypeImports: Map<string, string | null>,
  typeName: string
): void {
  const optional = param.required ? "" : "?";
  const type = renderSchemaType(
    param.schema,
    createRenderContext(
      options,
      `${typeName}Params.${param.name}`,
      knownTypeImports
    )
  );
  lines.push(`  ${param.name}${optional}: ${type};`);
}

function renderBodyInterface(
  typeName: string,
  operation: IROperation,
  options: TypesEmitterOptions,
  knownTypeImports: Map<string, string | null>
): string | undefined {
  if (
    !hasMeaningfulRequestBody(operation) ||
    operation.requestBody === undefined
  ) {
    return undefined;
  }

  const bodyType = renderSchemaType(
    operation.requestBody.schema,
    createRenderContext(options, `${typeName}Body`, knownTypeImports)
  );
  if (bodyType.startsWith("{")) {
    return `export interface ${typeName}Body ${bodyType}`;
  }
  return `export type ${typeName}Body = ${bodyType};`;
}

function resolveSuccessResponseSchema(
  schema: NonNullable<ReturnType<typeof getSuccessResponseSchema>>,
  components: IRSource["components"]["schemas"]
) {
  return schema.kind === "ref" ? resolveRef(schema, components) : schema;
}

function renderResponseType(
  typeName: string,
  operation: IROperation,
  options: TypesEmitterOptions,
  _envelopeMode: EnvelopeMode,
  knownTypeImports: Map<string, string | null>,
  baseImportPath: string
): string {
  const schema = getSuccessResponseSchema(operation);
  if (schema === undefined) {
    return `export type ${typeName}Response = unknown;`;
  }

  const resolved = resolveSuccessResponseSchema(
    schema,
    options.source.components.schemas
  );
  const dataSchema =
    resolved.kind === "object" && resolved.properties?.data !== undefined
      ? resolved.properties.data.schema
      : undefined;
  if (dataSchema !== undefined) {
    const dataType = renderSchemaType(
      dataSchema,
      createRenderContext(options, `${typeName}Response.data`, knownTypeImports)
    );
    const responseType = renderSchemaType(
      schema,
      createRenderContext(options, `${typeName}Response`, knownTypeImports)
    );
    return `export type ${typeName}Response = import("${baseImportPath}").BaseResponse<${dataType}> & Omit<${responseType}, "data">;`;
  }

  const responseType = renderSchemaType(
    schema,
    createRenderContext(options, `${typeName}Response`, knownTypeImports)
  );
  return `export type ${typeName}Response = ${responseType};`;
}

export interface GeneratedTypeFile {
  relativePath: string;
  content: string;
}

export function emitTypeFiles(
  options: TypesEmitterOptions
): Array<GeneratedTypeFile> {
  const files: Array<GeneratedTypeFile> = [];

  for (const pathItem of options.source.paths) {
    for (const operation of pathItem.operations) {
      const typeName = getFunctionTypeName(
        pathItem.cleanPath,
        operation.method
      );
      const knownTypeImports = new Map<string, string | null>();

      const blocks: Array<string> = [
        "// Auto-generated from OpenAPI spec",
        `// Path: ${operation.method.toUpperCase()} ${pathItem.path}`,
        "// DO NOT EDIT - This file is automatically generated",
        "",
      ];

      const paramsBlock = renderParamsInterface(
        typeName,
        operation,
        options,
        knownTypeImports
      );
      if (paramsBlock !== undefined) {
        blocks.push(paramsBlock, "");
      }

      const bodyBlock = renderBodyInterface(
        typeName,
        operation,
        options,
        knownTypeImports
      );
      if (bodyBlock !== undefined) {
        blocks.push(bodyBlock, "");
      }

      const typeFile = `${options.typesDir}/${pathItem.cleanPath}/${operation.method.toUpperCase()}.d.ts`;
      const baseImportPath = relativeImportPath(
        typeFile,
        options.baseFile.replace(/\.ts$/, "")
      );

      blocks.push(
        renderResponseType(
          typeName,
          operation,
          options,
          options.envelopeMode,
          knownTypeImports,
          baseImportPath
        )
      );

      const importLines = formatImportLines(knownTypeImports);
      const content = [
        ...importLines,
        ...(importLines.length > 0 ? [""] : []),
        ...blocks,
      ]
        .join("\n")
        .trimEnd();

      files.push({
        content: `${content}\n`,
        relativePath: `${pathItem.cleanPath}/${operation.method.toUpperCase()}.d.ts`,
      });
    }
  }

  return files;
}

export function emitBaseFile(sharedEnvelope: EnvelopeShape): string {
  const lines = [
    "// Auto-generated from OpenAPI spec",
    "// DO NOT EDIT - This file is automatically generated",
    "",
    buildBaseResponseInterface(sharedEnvelope),
    "",
  ];
  return lines.join("\n");
}
