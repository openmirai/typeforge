import {
  buildBaseResponseInterface,
  isEnvelopeSchema,
  matchesEnvelopeShape,
} from "../../envelope-guard/index";
import type { EnvelopeMode, EnvelopeShape } from "../../envelope-guard/index";
import type { QueryExtendsConfig } from "../../config/types";
import { DEFAULT_MAX_RENDER_DEPTH } from "../../config/types";
import type { JsonObject } from "../../json/types";
import type { KnownTypeRule } from "../../plugins/known-types/index";
import type { IROperation, IRQueryParam, IRSource } from "../../parser/types";
import type { TsconfigPathsConfig } from "../../utils/tsconfig-paths";
import { resolveAliasAwareImport } from "../../utils/imports";
import { getSchemaTypeDoc, renderSchemaType } from "../schema-renderer";
import type { SchemaRenderContext } from "../schema-renderer";
import { resolveObjectSchema } from "../resolve-schema";
import { renderTypeDoc } from "../tsdoc";
import type { TypeDoc } from "../tsdoc";
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
  unwrapResponseData?: boolean;
  typesDir: string;
  baseFile: string;
  tsconfigPaths?: TsconfigPathsConfig;
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

function combineTypeDoc(
  descriptions: Array<string | undefined>,
  deprecated: boolean
): TypeDoc {
  const documentation: TypeDoc = {};
  const description = descriptions.find(
    (candidate) => candidate !== undefined && candidate.trim().length > 0
  );
  if (description !== undefined) {
    documentation.description = description;
  }
  if (deprecated) {
    documentation.deprecated = true;
  }
  return documentation;
}

function documentDeclaration(
  declaration: string,
  documentation: TypeDoc
): string {
  const comment = renderTypeDoc(documentation);
  return comment.length === 0
    ? declaration
    : [...comment, declaration].join("\n");
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
    return documentDeclaration(
      `export type ${typeName}Params = ${extendsParts.join(" & ")};`,
      combineTypeDoc([], operation.deprecated === true)
    );
  }

  const lines: Array<string> = [];
  lines.push(
    ...renderTypeDoc(combineTypeDoc([], operation.deprecated === true))
  );
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
  const schemaDocumentation = getSchemaTypeDoc(
    param.schema,
    options.source.components.schemas
  );
  lines.push(
    ...renderTypeDoc(
      combineTypeDoc(
        [param.description, schemaDocumentation.description],
        param.deprecated === true || schemaDocumentation.deprecated === true
      ),
      "  "
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
  const schemaDocumentation = getSchemaTypeDoc(
    operation.requestBody.schema,
    options.source.components.schemas
  );
  const documentation = combineTypeDoc(
    [operation.requestBody.description, schemaDocumentation.description],
    operation.deprecated === true || schemaDocumentation.deprecated === true
  );
  if (bodyType.startsWith("{")) {
    return documentDeclaration(
      `export interface ${typeName}Body ${bodyType}`,
      documentation
    );
  }
  return documentDeclaration(
    `export type ${typeName}Body = ${bodyType};`,
    documentation
  );
}

function resolveSuccessResponseSchema(
  schema: NonNullable<ReturnType<typeof getSuccessResponseSchema>>,
  components: IRSource["components"]["schemas"]
) {
  return resolveObjectSchema(schema, components) ?? schema;
}

function renderResponseDeclaration(
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
  const isSuccessEnvelope =
    resolved.kind === "object" &&
    resolved.properties?.success !== undefined &&
    isEnvelopeSchema(schema, options.source.components.schemas);
  if (options.unwrapResponseData === true && isSuccessEnvelope) {
    if (dataSchema === undefined) {
      return `export type ${typeName}Response = null;`;
    }
    const dataType = renderSchemaType(
      dataSchema,
      createRenderContext(options, `${typeName}Response.data`, knownTypeImports)
    );
    return `export type ${typeName}Response = ${dataType};`;
  }

  if (dataSchema !== undefined) {
    const usesBaseResponse =
      _envelopeMode === "shared" ||
      (_envelopeMode === "mixed" &&
        options.sharedEnvelope !== undefined &&
        matchesEnvelopeShape(
          schema,
          options.source.components.schemas,
          options.sharedEnvelope
        ));
    if (!usesBaseResponse) {
      const responseType = renderSchemaType(
        schema,
        createRenderContext(options, `${typeName}Response`, knownTypeImports)
      );
      return `export type ${typeName}Response = ${responseType};`;
    }

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

function renderResponseType(
  typeName: string,
  operation: IROperation,
  options: TypesEmitterOptions,
  envelopeMode: EnvelopeMode,
  knownTypeImports: Map<string, string | null>,
  baseImportPath: string
): string {
  const schema = getSuccessResponseSchema(operation);
  const response =
    schema === undefined
      ? operation.responses.find((candidate) =>
          candidate.statusCode.startsWith("2")
        )
      : operation.responses.find((candidate) => candidate.schema === schema);
  const schemaDocumentation =
    schema === undefined
      ? {}
      : getSchemaTypeDoc(schema, options.source.components.schemas);
  const documentation = combineTypeDoc(
    [schemaDocumentation.description, response?.description],
    operation.deprecated === true || schemaDocumentation.deprecated === true
  );

  return documentDeclaration(
    renderResponseDeclaration(
      typeName,
      operation,
      options,
      envelopeMode,
      knownTypeImports,
      baseImportPath
    ),
    documentation
  );
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
      const baseImportPath = resolveAliasAwareImport({
        fromAbsolutePath: typeFile,
        toAbsolutePath: options.baseFile
          .replace(/\.d\.ts$/, "")
          .replace(/\.ts$/, ""),
        ...(options.tsconfigPaths === undefined
          ? {}
          : { tsconfigPaths: options.tsconfigPaths }),
      });

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
