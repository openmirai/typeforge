import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { runCli } from "../helpers/cli";
import { createMonolithProject } from "../helpers/project";

const fixtureRoot = fileURLToPath(new URL("../fixtures", import.meta.url));
const singleEndpoint = readFileSync(
  join(fixtureRoot, "specs/envelope-list.json"),
  "utf8"
);

describe("e2e cli accept-base", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("accept-base rewrites models.ts BaseResponse from spec", () => {
    const root = join(fixtureRoot, "layouts", `cli-accept-${Date.now()}`);
    tempRoots.push(root);
    createMonolithProject({
      modelsContent: `export interface BaseResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  error?: string;
}

export type ItemList = BaseResponse<Array<{ id: string }>>;`,
      root,
      sourceKey: "atlas",
      specContent: singleEndpoint,
    });

    expect(runCli(root, ["generate", "--source", "atlas"]).exitCode).toBe(1);

    const accept = runCli(root, ["accept-base", "--source", "atlas"]);
    expect(accept.exitCode).toBe(0);

    const models = readFileSync(join(root, "src/api/models.ts"), "utf8");
    expect(models).toContain("ItemList");
    expect(models).not.toContain("error?: string");
    expect(existsSync(join(root, "src/api/atlas/generated/base.ts"))).toBe(
      true
    );
  });

  it("generate --all processes every source with source.ts", () => {
    const root = join(fixtureRoot, "layouts", `cli-all-${Date.now()}`);
    tempRoots.push(root);
    mkdirSync(join(root, "src/api/alpha"), { recursive: true });
    mkdirSync(join(root, "src/api/beta"), { recursive: true });
    writeFileSync(
      join(root, "typeforge.json"),
      JSON.stringify({ apiRoot: "src/api" }),
      "utf8"
    );
    writeFileSync(
      join(root, "src/api/http.ts"),
      `export const httpFetch = {
  delete: async () => ({ data: undefined }),
  get: async () => ({ data: undefined }),
  patch: async () => ({ data: undefined }),
  post: async () => ({ data: undefined }),
  put: async () => ({ data: undefined }),
} as const;
`,
      "utf8"
    );
    for (const key of ["alpha", "beta"]) {
      writeFileSync(
        join(root, `src/api/${key}/source.ts`),
        `export default { pathPrefix: "/api/acme/v3", stripApiPrefix: true, generationMode: "authoritative" as const };`,
        "utf8"
      );
      writeFileSync(
        join(root, `src/api/${key}/spec.json`),
        singleEndpoint,
        "utf8"
      );
    }

    const result = runCli(root, ["generate", "--all"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('"alpha"');
    expect(result.stdout).toContain('"beta"');
  });
});
