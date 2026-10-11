import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  detectHttpMode,
  hasQueryScopeFile,
  loadProjectConfig,
  loadSourceConfig,
  readModelsFile,
} from "../config/load";
import type { SourceConfig } from "../config/types";
import { DEFAULT_ROUTE_ENUM_NAME } from "../config/types";
import { emitFunctionFiles } from "../emitters/functions/index";
import { emitRuntimeFile } from "../emitters/runtime/index";
import { emitRoutesFile, mergeRoutesFile } from "../emitters/routes/index";
import { emitBaseFile, emitTypeFiles } from "../emitters/types/index";
import type { TypesEmitterOptions } from "../emitters/types/index";
import {
  analyzeEnvelope,
  buildBaseResponseInterface,
  diffEnvelopeFields,
  getPrimaryEnvelopeShape,
  parseUserBaseResponse,
} from "../envelope-guard/index";
import { formatDriftError } from "../envelope-guard/diagnostic";
import { loadKnownTypeRules } from "../plugins/known-types/index";
import { isJsonObject } from "../json/types";
import { loadSpec, resolveSpecSource } from "../parser/loader";
import { parseSpec } from "../parser/index";
import type { IRSource } from "../parser/types";
import { loadTsconfigPaths } from "../utils/tsconfig-paths";
import { writeOutputFiles } from "../utils/output";
import type { OutputFile } from "../utils/output";
import { acquireGitSpec } from "./acquisition";
import { outputPath, planOwnership, stripOwnership } from "./ownership";

export interface GenerateOptions {
  cwd?: string;
  sourceKey: string;
  specFlag?: string;
  check?: boolean;
  acceptBase?: boolean;
  /** Explicitly accept the Git source configured in source.ts. */
  update?: boolean;
}

export interface GenerateResult {
  sourceKey: string;
  files: number;
  changed: Array<string>;
  check: boolean;
  obsolete: Array<string>;
  conflicts: Array<string>;
}

export interface GenerateContext {
  cwd: string;
  apiRoot: string;
  sourceKey: string;
  sourceConfig: SourceConfig;
  sourceDir: string;
  generatedDir: string;
  typesDir: string;
  functionsDir: string;
  routesFile: string;
  baseFile: string;
  snapshotPath: string;
  httpMode: "singleton" | "injected";
  hasQueryScope: boolean;
}

export function buildGenerateContext(
  cwd: string,
  sourceKey: string
): GenerateContext {
  const projectConfig = loadProjectConfig(cwd);
  const apiRoot = projectConfig.apiRoot ?? "src/api";
  const sourceConfig = loadSourceConfig(cwd, apiRoot, sourceKey);
  const sourceDir = resolve(cwd, apiRoot, sourceKey);
  const generatedDir = join(sourceDir, "generated");
  const functionsDir =
    sourceConfig.functionsDir === undefined
      ? join(generatedDir, "functions")
      : resolve(cwd, sourceConfig.functionsDir);
  const typesDir =
    sourceConfig.typesDir === undefined
      ? join(generatedDir, "types")
      : resolve(cwd, sourceConfig.typesDir);

  return {
    apiRoot,
    baseFile:
      sourceConfig.typesDir === undefined
        ? join(generatedDir, "base.ts")
        : join(dirname(typesDir), "base.d.ts"),
    cwd,
    functionsDir,
    generatedDir,
    hasQueryScope:
      sourceConfig.tanstackQuery === true && hasQueryScopeFile(cwd, apiRoot),
    httpMode: detectHttpMode(cwd, apiRoot),
    routesFile: join(generatedDir, "routes.ts"),
    snapshotPath: join(sourceDir, "spec.json"),
    sourceConfig,
    sourceDir,
    sourceKey,
    typesDir,
  };
}

function validateEnvelope(
  context: GenerateContext,
  source: IRSource,
  acceptBase: boolean
): { mode: ReturnType<typeof analyzeEnvelope>["mode"]; error?: string } {
  const analysis = analyzeEnvelope(source);

  if (analysis.mode !== "shared" || analysis.shared === undefined) {
    return { mode: analysis.mode };
  }

  const modelsContent = readModelsFile(context.cwd, context.apiRoot);
  if (modelsContent === undefined) {
    return { mode: analysis.mode };
  }

  const userBase = parseUserBaseResponse(modelsContent);
  if (userBase === undefined) {
    return { mode: analysis.mode };
  }

  const diffs = diffEnvelopeFields(analysis.shared, userBase);
  if (diffs.length === 0) {
    return { mode: analysis.mode };
  }

  if (acceptBase) {
    return { mode: analysis.mode };
  }

  const userBlock = userBase.fields
    .map(
      (field) => `  ${field.name}${field.required ? "" : "?"}: ${field.kind};`
    )
    .join("\n");

  return {
    error: formatDriftError(
      context.sourceKey,
      analysis.shared,
      userBase.sourcePath,
      userBlock,
      diffs
    ),
    mode: analysis.mode,
  };
}

function patchModelsBaseResponse(
  cwd: string,
  apiRoot: string,
  newInterface: string
): OutputFile | undefined {
  const modelsPath = resolve(cwd, apiRoot, "models.ts");
  if (!existsSync(modelsPath)) {
    return;
  }

  const content = readFileSync(modelsPath, "utf8");
  const patched = content.replace(
    /export\s+interface\s+BaseResponse\s*<[^>]*>\s*\{[\s\S]*?\}/,
    newInterface
  );
  return { path: modelsPath, content: patched };
}

export interface GenerationPlan {
  files: Array<OutputFile>;
  obsolete: Array<string>;
  result: GenerateResult;
}

/** Prepare and validate all changes in memory before any filesystem mutations. */
export async function prepareGeneration(
  options: GenerateOptions
): Promise<GenerationPlan> {
  if (options.check && (options.acceptBase || options.update)) {
    throw new Error("--check cannot be combined with --accept-base or update");
  }
  const cwd = resolve(options.cwd ?? process.cwd());
  const context = buildGenerateContext(cwd, options.sourceKey);
  const specConfig = context.sourceConfig.spec;
  let acquired: Array<OutputFile> = [];
  let rawSpec;
  if (typeof specConfig === "object") {
    const envName = `OPENAPI_SPEC_${options.sourceKey.toUpperCase().replace(/-/g, "_")}`;
    if (options.specFlag !== undefined || process.env[envName] !== undefined) {
      throw new Error(
        "Git provenance cannot be bypassed with --spec or OPENAPI_SPEC overrides"
      );
    }
    const acquisition = acquireGitSpec(
      cwd,
      context.sourceDir,
      specConfig,
      options.update === true
    );
    rawSpec = acquisition.spec;
    acquired = acquisition.files;
  } else {
    if (options.update) {
      throw new Error("typeforge update requires a Git spec source");
    }
    const specSource = resolveSpecSource(options.sourceKey, {
      snapshotPath: context.snapshotPath,
      localOverridePath: resolve(cwd, "typeforge.local.json"),
      ...(options.specFlag === undefined ? {} : { specFlag: options.specFlag }),
      ...(specConfig === undefined ? {} : { sourceConfigSpec: specConfig }),
    });
    rawSpec = await loadSpec(specSource, cwd);
  }

  const parseOptions: {
    ignorePaths?: Array<string>;
    pathPrefix?: string;
  } = {};
  if (context.sourceConfig.ignorePaths !== undefined) {
    parseOptions.ignorePaths = context.sourceConfig.ignorePaths;
  }
  if (context.sourceConfig.pathPrefix !== undefined) {
    parseOptions.pathPrefix = context.sourceConfig.pathPrefix;
  }
  const source = parseSpec(rawSpec, parseOptions);
  source.key = options.sourceKey;

  const envelopeCheck = validateEnvelope(
    context,
    source,
    options.acceptBase === true
  );
  if (envelopeCheck.error !== undefined) {
    throw new Error(envelopeCheck.error);
  }

  const analysis = analyzeEnvelope(source);
  const outputFiles: Array<OutputFile> = [];
  const auxiliaryFiles: Array<OutputFile> = [...acquired];

  const primaryEnvelope = getPrimaryEnvelopeShape(analysis);
  if (primaryEnvelope !== undefined) {
    outputFiles.push({
      content: emitBaseFile(primaryEnvelope),
      path: context.baseFile,
    });

    if (options.acceptBase === true) {
      const patch = patchModelsBaseResponse(
        cwd,
        context.apiRoot,
        buildBaseResponseInterface(primaryEnvelope)
      );
      if (patch) {
        auxiliaryFiles.push(patch);
      }
    }
  }

  const typeEmitterOptions: TypesEmitterOptions = {
    baseFile: context.baseFile,
    envelopeMode: analysis.mode,
    knownTypes: loadKnownTypeRules(cwd, context.apiRoot),
    source,
    sourceKey: options.sourceKey,
    typesDir: context.typesDir,
  };
  if (context.sourceConfig.resolveMapKeyRefs !== undefined) {
    typeEmitterOptions.resolveMapKeyRefs =
      context.sourceConfig.resolveMapKeyRefs;
  }
  if (context.sourceConfig.unwrapResponseData !== undefined) {
    typeEmitterOptions.unwrapResponseData =
      context.sourceConfig.unwrapResponseData;
  }
  if (primaryEnvelope !== undefined) {
    typeEmitterOptions.sharedEnvelope = primaryEnvelope;
  }
  const typesTsconfigPaths = loadTsconfigPaths(context.typesDir);
  if (typesTsconfigPaths !== undefined) {
    typeEmitterOptions.tsconfigPaths = typesTsconfigPaths;
  }
  if (context.sourceConfig.maxRenderDepth !== undefined) {
    typeEmitterOptions.maxRenderDepth = context.sourceConfig.maxRenderDepth;
  }
  if (context.sourceConfig.queryExtends !== undefined) {
    typeEmitterOptions.queryExtends = context.sourceConfig.queryExtends;
  }
  if (isJsonObject(rawSpec)) {
    typeEmitterOptions.rawSpec = rawSpec;
  }

  const typeFiles = emitTypeFiles(typeEmitterOptions);
  for (const file of typeFiles) {
    outputFiles.push({
      content: file.content,
      path: join(context.typesDir, file.relativePath),
    });
  }

  const routeEnumName =
    context.sourceConfig.routeEnumName ?? DEFAULT_ROUTE_ENUM_NAME;
  const routesOptions: {
    paths: typeof source.paths;
    routeEnumName: string;
    stripApiPrefix?: boolean;
  } = {
    paths: source.paths,
    routeEnumName,
  };
  if (context.sourceConfig.stripApiPrefix === true) {
    routesOptions.stripApiPrefix = true;
  }
  const routesContent = emitRoutesFile(routesOptions);

  let finalRoutes = routesContent;
  if (
    context.sourceConfig.generationMode === "merge" &&
    existsSync(context.routesFile)
  ) {
    finalRoutes = mergeRoutesFile(
      stripOwnership(readFileSync(context.routesFile, "utf8")),
      routesContent,
      routeEnumName,
      context.sourceConfig.pathPrefix
    );
  }

  outputFiles.push({
    content: finalRoutes,
    path: context.routesFile,
  });

  outputFiles.push({
    content: emitRuntimeFile({
      hasQueryScope: context.hasQueryScope,
      httpMode: context.httpMode,
    }),
    path: join(context.generatedDir, "runtime.ts"),
  });

  const tsconfigPaths = loadTsconfigPaths(context.functionsDir);
  const functionEmitterOptions: Parameters<typeof emitFunctionFiles>[0] = {
    functionsDir: context.functionsDir,
    generatedDir: context.generatedDir,
    hasQueryScope: context.hasQueryScope,
    httpMode: context.httpMode,
    paths: source.paths,
    routeEnumName,
    typesDir: context.typesDir,
  };
  if (context.sourceConfig.importBase !== undefined) {
    functionEmitterOptions.importBase = context.sourceConfig.importBase;
  } else if (tsconfigPaths !== undefined) {
    functionEmitterOptions.tsconfigPaths = tsconfigPaths;
  }
  const functionFiles = emitFunctionFiles(functionEmitterOptions);

  for (const file of functionFiles) {
    outputFiles.push({
      content: file.content,
      path: join(context.functionsDir, file.relativePath),
    });
  }

  const ownership = planOwnership(
    cwd,
    context.sourceDir,
    [
      context.generatedDir,
      context.functionsDir,
      context.typesDir,
      context.baseFile,
    ],
    outputFiles,
    context.sourceConfig.generationMode === "merge",
    context.routesFile
  );
  for (const file of auxiliaryFiles) {
    outputPath(cwd, file.path);
  }
  if (!options.check && ownership.conflicts.length > 0) {
    throw new Error(
      `Refusing to overwrite unowned files or delete edited obsolete files:\n${ownership.conflicts.join("\n")}`
    );
  }
  const files = [...ownership.files, ...auxiliaryFiles];
  const comparison = await writeOutputFiles(files, true, ownership.obsolete);
  return {
    files,
    obsolete: ownership.obsolete,
    result: {
      changed: [...new Set([...comparison.changed, ...ownership.conflicts])],
      check: options.check === true,
      files: outputFiles.length,
      sourceKey: options.sourceKey,
      obsolete: ownership.obsolete,
      conflicts: ownership.conflicts,
    },
  };
}

export async function generateForSource(
  options: GenerateOptions
): Promise<GenerateResult> {
  const plan = await prepareGeneration(options);
  if (!options.check) {
    await writeOutputFiles(plan.files, false, plan.obsolete);
  }
  return plan.result;
}
