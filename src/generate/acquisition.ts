import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { GitSpecSource } from "../config/types";
import { isJsonObject, parseJson } from "../json/types";
import type { JsonValue } from "../json/types";
import type { OutputFile } from "../utils/output";

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function canonical(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(",")}]`;
  }
  if (isJsonObject(value)) {
    return `{${Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Reads only committed objects. Never fetches, checks out, or consults working-tree bytes. */
export function acquireGitSpec(
  cwd: string,
  sourceDir: string,
  config: GitSpecSource,
  update: boolean
): { spec: JsonValue; files: Array<OutputFile> } {
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(config.commit)) {
    throw new Error(
      "Provenance drift: Git spec commit must be a full immutable commit ID"
    );
  }
  if (
    !config.path ||
    config.path.startsWith("/") ||
    config.path
      .split("/")
      .some((part) => part === ".." || part === "." || part === "") ||
    config.path.includes("\\")
  ) {
    throw new Error(
      "Git spec path must be repository-relative without traversal"
    );
  }
  const envName = config.repository.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/)?.[1];
  const location = envName ? process.env[envName] : config.repository;
  if (!location) {
    throw new Error(
      `Git repository location is required: ${config.repository}`
    );
  }
  const repository = resolve(cwd, location);
  const git = (...args: Array<string>): Buffer =>
    execFileSync("git", ["--no-replace-objects", "-C", repository, ...args], {
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_NO_LAZY_FETCH: "1" },
    });
  let raw: Buffer;
  try {
    if (git("cat-file", "-t", config.commit).toString().trim() !== "commit") {
      throw new Error("Object is not a commit");
    }
    raw = git("cat-file", "blob", `${config.commit}:${config.path}`);
  } catch (error) {
    throw new Error(
      `Spec acquisition failed at ${config.commit}:${config.path}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
  const spec = parseJson(raw.toString("utf8"));
  if (
    !isJsonObject(spec) ||
    !isJsonObject(spec["paths"]) ||
    !(
      spec["swagger"] === "2.0" ||
      (typeof spec["openapi"] === "string" && spec["openapi"].startsWith("3."))
    )
  ) {
    throw new Error(
      "Spec validation failed: expected Swagger 2 or OpenAPI 3 with a paths object"
    );
  }
  const receipt = {
    version: 1,
    source: { ...config },
    rawSha256: sha256(raw),
    normalizedSha256: sha256(canonical(spec)),
  };
  const receiptPath = join(sourceDir, "typeforge.provenance.json");
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  if (!update) {
    let recorded: JsonValue;
    try {
      recorded = parseJson(readFileSync(receiptPath, "utf8"));
    } catch {
      throw new Error(
        "Provenance drift: missing or invalid receipt; run typeforge update explicitly"
      );
    }
    if (canonical(recorded) !== canonical(receipt)) {
      throw new Error(
        "Provenance drift: source revision or content hashes differ from receipt; review and run typeforge update explicitly"
      );
    }
  }
  return {
    spec,
    files: [
      { path: join(sourceDir, "spec.json"), content: raw.toString("utf8") },
      { path: receiptPath, content },
    ],
  };
}
