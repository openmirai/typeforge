import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { DeclarativeKnownTypeRule, KnownTypeRule } from "./types";
import { matchesDeclarativeRule } from "./matchers";

function parseStringArray(
  block: string | undefined
): Array<string> | undefined {
  if (block === undefined) {
    return undefined;
  }
  const values = [...block.matchAll(/["'`]([^"'`]+)["'`]/g)].map(
    (match) => match[1]!
  );
  return values.length > 0 ? values : undefined;
}

function parseDeclarativeRules(
  content: string
): Array<DeclarativeKnownTypeRule> {
  const rules: Array<DeclarativeKnownTypeRule> = [];
  const objectBlocks = content.matchAll(/\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g);

  for (const block of objectBlocks) {
    const body = block[1];
    if (body === undefined || !body.includes("typeName")) {
      continue;
    }

    const name = body.match(/name:\s*["'`]([^"'`]+)["'`]/)?.[1];
    const typeName = body.match(/typeName:\s*["'`]([^"'`]+)["'`]/)?.[1];
    if (name === undefined || typeName === undefined) {
      continue;
    }

    const rule: DeclarativeKnownTypeRule = { name, typeName };
    const importPath = body.match(
      /importPath:\s*(null|["'`]([^"'`]*)["'`])/
    )?.[2];
    if (body.includes("importPath: null")) {
      rule.importPath = null;
    } else if (importPath !== undefined) {
      rule.importPath = importPath;
    }

    const exactProperties = parseStringArray(
      body.match(/exactProperties:\s*\[([\s\S]*?)\]/)?.[1]
    );
    if (exactProperties !== undefined) {
      rule.exactProperties = exactProperties;
    }

    const requireProperties = parseStringArray(
      body.match(/requireProperties:\s*\[([\s\S]*?)\]/)?.[1]
    );
    if (requireProperties !== undefined) {
      rule.requireProperties = requireProperties;
    }

    const excludeProperties = parseStringArray(
      body.match(/excludeProperties:\s*\[([\s\S]*?)\]/)?.[1]
    );
    if (excludeProperties !== undefined) {
      rule.excludeProperties = excludeProperties;
    }

    const maxPropertyCount = body.match(/maxPropertyCount:\s*(\d+)/)?.[1];
    if (maxPropertyCount !== undefined) {
      rule.maxPropertyCount = Number.parseInt(maxPropertyCount, 10);
    }

    rules.push(rule);
  }

  return rules;
}

export function loadUserKnownTypes(
  cwd: string,
  apiRoot: string
): Array<KnownTypeRule> {
  const knownTypesPath = resolve(cwd, apiRoot, "known-types.ts");
  if (!existsSync(knownTypesPath)) {
    return [];
  }

  const content = readFileSync(knownTypesPath, "utf8");
  return parseDeclarativeRules(content).map((rule): KnownTypeRule => ({
    importPath: rule.importPath ?? null,
    matcher: (schema, components) =>
      matchesDeclarativeRule(schema, components, rule),
    name: rule.name,
    typeName: rule.typeName,
  }));
}
