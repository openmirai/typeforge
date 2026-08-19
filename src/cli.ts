#!/usr/bin/env node
import { listSourceKeys, loadProjectConfig } from "./config/load";
import { generateForSource } from "./generate/index";
import type { GenerateOptions } from "./generate/index";
import { initProject } from "./init/index";
import type { InitOptions } from "./init/index";

interface ParsedArgs {
  command?: string;
  source?: string;
  spec?: string;
  client?: "axios" | "fetch" | "custom";
  layout?: "monolith" | "packages";
  check?: boolean;
  acceptBase?: boolean;
  all?: boolean;
}

function parseArgs(argv: Array<string>): ParsedArgs {
  const parsed: ParsedArgs = {};
  const positional: Array<string> = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) {
      continue;
    }

    if (arg === "--check") {
      parsed.check = true;
      continue;
    }
    if (arg === "--accept-base") {
      parsed.acceptBase = true;
      continue;
    }
    if (arg === "--all") {
      parsed.all = true;
      continue;
    }
    if (arg.startsWith("--source=")) {
      parsed.source = arg.slice("--source=".length);
      continue;
    }
    if (arg === "--source") {
      const value = argv[index + 1];
      if (value !== undefined) {
        parsed.source = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--spec=")) {
      parsed.spec = arg.slice("--spec=".length);
      continue;
    }
    if (arg === "--spec") {
      const value = argv[index + 1];
      if (value !== undefined) {
        parsed.spec = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--client=")) {
      const value = arg.slice("--client=".length);
      if (value === "axios" || value === "fetch" || value === "custom") {
        parsed.client = value;
      }
      continue;
    }
    if (arg === "--client") {
      const value = argv[index + 1];
      if (value === "axios" || value === "fetch" || value === "custom") {
        parsed.client = value;
        index += 1;
      }
      continue;
    }
    if (arg.startsWith("--layout=")) {
      const value = arg.slice("--layout=".length);
      if (value === "monolith" || value === "packages") {
        parsed.layout = value;
      }
      continue;
    }
    if (arg === "--layout") {
      const value = argv[index + 1];
      if (value === "monolith" || value === "packages") {
        parsed.layout = value;
        index += 1;
      }
      continue;
    }
    if (!arg.startsWith("-")) {
      positional.push(arg);
    }
  }

  const command = positional[0];
  if (command !== undefined) {
    parsed.command = command;
  }
  return parsed;
}

function printHelp(): void {
  process.stdout.write(`openapi-codegen — headless OpenAPI TypeScript codegen

Usage:
  openapi-codegen init --source <key> --client axios|fetch|custom [--layout monolith|packages]
  openapi-codegen generate --source <key> [--spec <path>] [--check] [--accept-base] [--all]
  openapi-codegen check --source <key> [--spec <path>]
  openapi-codegen accept-base --source <key> [--spec <path>]
`);
}

async function runGenerate(args: ParsedArgs): Promise<number> {
  if (args.check === true && args.acceptBase === true) {
    process.stderr.write(
      "openapi-codegen: --accept-base is not allowed with --check\n"
    );
    return 1;
  }

  const cwd = process.cwd();
  const projectConfig = loadProjectConfig(cwd);
  const apiRoot = projectConfig.apiRoot ?? "src/api";
  let sources: Array<string>;
  if (args.all === true) {
    sources = listSourceKeys(cwd, apiRoot);
  } else if (args.source !== undefined) {
    sources = [args.source];
  } else {
    sources = [];
  }

  if (sources.length === 0) {
    process.stderr.write("openapi-codegen: --source is required\n");
    return 1;
  }

  let exitCode = 0;
  for (const sourceKey of sources) {
    try {
      const generateOptions: GenerateOptions = { sourceKey };
      if (args.acceptBase === true) {
        generateOptions.acceptBase = true;
      }
      if (args.check === true) {
        generateOptions.check = true;
      }
      if (args.spec !== undefined) {
        generateOptions.specFlag = args.spec;
      }

      const result = await generateForSource(generateOptions);

      if (args.check === true) {
        if (result.changed.length > 0) {
          process.stderr.write(
            `openapi-codegen: stale generated files for "${sourceKey}":\n`
          );
          for (const file of result.changed) {
            process.stderr.write(`  ${file}\n`);
          }
          exitCode = 1;
        } else {
          process.stdout.write(
            `openapi-codegen: "${sourceKey}" is up to date\n`
          );
        }
      } else {
        process.stdout.write(
          `openapi-codegen: generated ${result.files} files for "${sourceKey}" (${result.changed.length} changed)\n`
        );
      }
    } catch (error) {
      exitCode = 1;
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
    }
  }

  return exitCode;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (
    args.command === undefined ||
    args.command === "help" ||
    args.command === "--help" ||
    args.command === "-h"
  ) {
    printHelp();
    process.exit(0);
  }

  if (args.command === "init") {
    if (args.source === undefined || args.client === undefined) {
      process.stderr.write(
        "openapi-codegen: init requires --source and --client\n"
      );
      process.exit(1);
    }

    const initOptions: InitOptions = {
      client: args.client,
      sourceKey: args.source,
    };
    if (args.layout !== undefined) {
      initOptions.layout = args.layout;
    }

    const result = initProject(initOptions);

    for (const file of result.created) {
      process.stdout.write(`created ${file}\n`);
    }
    for (const file of result.skipped) {
      process.stdout.write(`skipped ${file} (already exists)\n`);
    }
    process.exit(0);
  }

  if (
    args.command === "generate" ||
    args.command === "check" ||
    args.command === "accept-base"
  ) {
    if (args.command === "check") {
      args.check = true;
    }
    if (args.command === "accept-base") {
      args.acceptBase = true;
    }
    process.exit(await runGenerate(args));
  }

  process.stderr.write(`openapi-codegen: unknown command "${args.command}"\n`);
  printHelp();
  process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
