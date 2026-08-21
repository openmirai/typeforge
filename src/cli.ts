#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { listSourceKeys, loadProjectConfig } from "./config/load";
import { generateForSource } from "./generate/index";
import type { GenerateOptions } from "./generate/index";
import { initProject } from "./init/index";
import type { InitOptions } from "./init/index";

interface ParsedArgs {
  command?: string;
  /** Populated by the first --source value; kept for init (single-source) compat. */
  source?: string;
  /** All --source values collected for multi-source generate. */
  sources: Array<string>;
  spec?: string;
  client?: "axios" | "fetch" | "custom";
  layout?: "monolith" | "packages";
  check?: boolean;
  acceptBase?: boolean;
  all?: boolean;
}

export function parseArgs(argv: Array<string>): ParsedArgs {
  const parsed: ParsedArgs = { sources: [] };
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
      const value = arg.slice("--source=".length);
      parsed.sources.push(value);
      if (parsed.source === undefined) {
        parsed.source = value;
      }
      continue;
    }
    if (arg === "--source") {
      const value = argv[index + 1];
      if (value !== undefined) {
        parsed.sources.push(value);
        if (parsed.source === undefined) {
          parsed.source = value;
        }
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
  process.stdout.write(`typeforge — headless OpenAPI TypeScript codegen

Usage:
  typeforge init --source <key> --client axios|fetch|custom [--layout monolith|packages]
  typeforge generate --source <key> [--source <key2> ...] [--spec <path>] [--check] [--accept-base]
  typeforge generate --all [--check] [--accept-base]
  typeforge check --source <key> [--spec <path>]
  typeforge accept-base --source <key> [--spec <path>]

Multi-source generate:
  Provide multiple --source flags, or use --all to generate every source under apiRoot.
  Configure per-source spec paths in each source.ts:
    import { defineSourceConfig } from "@openmirai/typeforge";
    export default defineSourceConfig({ spec: "./specs/acme.json", ... });
`);
}

async function runGenerate(args: ParsedArgs): Promise<number> {
  if (args.check === true && args.acceptBase === true) {
    process.stderr.write(
      "typeforge: --accept-base is not allowed with --check\n"
    );
    return 1;
  }

  const cwd = process.cwd();
  const projectConfig = loadProjectConfig(cwd);
  const apiRoot = projectConfig.apiRoot ?? "src/api";
  let sources: Array<string>;
  if (args.all === true) {
    sources = listSourceKeys(cwd, apiRoot);
  } else if (args.sources.length > 0) {
    sources = args.sources;
  } else {
    sources = [];
  }

  if (sources.length === 0) {
    process.stderr.write("typeforge: --source <key> or --all is required\n");
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
            `typeforge: stale generated files for "${sourceKey}":\n`
          );
          for (const file of result.changed) {
            process.stderr.write(`  ${file}\n`);
          }
          exitCode = 1;
        } else {
          process.stdout.write(`typeforge: "${sourceKey}" is up to date\n`);
        }
      } else {
        process.stdout.write(
          `typeforge: generated ${result.files} files for "${sourceKey}" (${result.changed.length} changed)\n`
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
      process.stderr.write("typeforge: init requires --source and --client\n");
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

  process.stderr.write(`typeforge: unknown command "${args.command}"\n`);
  printHelp();
  process.exit(1);
}

// Only auto-execute when this file is the Node.js entry point.
// Guarding with import.meta.url allows the module to be safely imported
// in tests without triggering process.exit.
const isEntryPoint = ((): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    return false;
  }
})();

if (isEntryPoint) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
