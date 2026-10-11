import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateForSource } from "../../src/generate/index";
import { sha256 } from "../../src/generate/acquisition";

const roots: Array<string> = [];
afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
  delete process.env["TYPEFORGE_TEST_REPO"];
});
const spec = (path = "/old") =>
  JSON.stringify({
    openapi: "3.0.3",
    info: { title: "test", version: "1" },
    paths: {
      [path]: {
        get: {
          responses: {
            "200": {
              description: "ok",
              content: { "application/json": { schema: { type: "string" } } },
            },
          },
        },
      },
    },
  });
const git = (cwd: string, ...args: Array<string>) =>
  execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
function setup() {
  const root = mkdtempSync(join(tmpdir(), "typeforge-pinned-"));
  roots.push(root);
  const backend = join(root, "producer");
  const cwd = join(root, "independent", "consumer");
  const sourceDir = join(cwd, "src/api/test");
  mkdirSync(backend);
  mkdirSync(sourceDir, { recursive: true });
  git(backend, "init");
  git(backend, "config", "commit.gpgsign", "false");
  git(backend, "config", "user.name", "Test");
  git(backend, "config", "user.email", "test@example.test");
  const commit = (content: string) => {
    writeFileSync(join(backend, "api.json"), content);
    git(backend, "add", "api.json");
    git(backend, "-c", "core.hooksPath=/dev/null", "commit", "-m", "spec");
    return git(backend, "rev-parse", "HEAD");
  };
  const revision = commit(spec());
  const configure = (
    configuredRevision: string,
    extra = "",
    repository = backend
  ) =>
    writeFileSync(
      join(sourceDir, "source.ts"),
      `export default { spec: { repository: ${JSON.stringify(repository)}, commit: "${configuredRevision}", path: "api.json" }, ${extra} };`
    );
  configure(revision);
  return {
    root,
    backend,
    cwd,
    sourceDir,
    revision,
    configure,
    commit,
    run: (options = {}) =>
      generateForSource({ cwd, sourceKey: "test", ...options }),
  };
}
function snapshot(root: string): unknown {
  const walk = (path: string): unknown => {
    const stat = lstatSync(path);
    return stat.isDirectory()
      ? {
          mode: stat.mode,
          mtime: stat.mtimeMs,
          entries: Object.fromEntries(
            readdirSync(path)
              .toSorted()
              .map((name) => [name, walk(join(path, name))])
          ),
        }
      : {
          mode: stat.mode,
          mtime: stat.mtimeMs,
          bytes: readFileSync(path).toString("base64"),
        };
  };
  return walk(root);
}
const cli = resolve("dist/cli.js");

describe("pinned Git generation without inventory files", () => {
  it("adopts legacy Typeforge banners without requiring an inventory or identical emitter versions", async () => {
    const p = setup();
    await p.run({ update: true });
    const file = join(p.sourceDir, "generated/functions/old/GET.ts");
    const legacy = `${readFileSync(file, "utf8").replace(
      /^.*\n/,
      ""
    )}// old emitter version\n`;
    writeFileSync(
      file,
      `import type { HTTPFetch } from "../../http";\n\n${legacy}`
    );
    await p.run();
    expect((await p.run({ check: true })).changed).toEqual([]);
    writeFileSync(file, legacy.replace("GET /old", "GET /another-source"));
    await expect(p.run()).rejects.toThrow(/Refusing/);
  });

  it("does not patch models, snapshot or receipt when rendering fails after accept-base", async () => {
    const p = setup();
    await p.run({ update: true });
    const recursive = readFileSync(
      resolve("test/fixtures/specs/recursive-node.json"),
      "utf8"
    );
    p.configure(p.commit(recursive));
    writeFileSync(
      join(p.cwd, "src/api/models.ts"),
      "export interface BaseResponse<T> { data: T; error?: string; }"
    );
    const before = snapshot(p.root);
    await expect(p.run({ update: true, acceptBase: true })).rejects.toThrow(
      /recursive|depth/i
    );
    expect(snapshot(p.root)).toEqual(before);
  });

  it("reads bare repositories and ignores Git replacement objects", async () => {
    const p = setup();
    const next = p.commit(spec("/replacement"));
    git(p.backend, "replace", p.revision, next);
    await p.run({ update: true });
    expect(readFileSync(join(p.sourceDir, "spec.json"), "utf8")).toBe(spec());
    const bare = join(p.root, "bare.git");
    git(p.root, "clone", "--bare", p.backend, bare);
    p.configure(p.revision, "", bare);
    await p.run({ update: true });
    expect((await p.run({ check: true })).changed).toEqual([]);
  });

  it("supports split monorepo outputs when endpoints disappear", async () => {
    const p = setup();
    const config =
      'functionsDir: "packages/utils/functions", typesDir: "packages/types/api"';
    p.configure(p.revision, config);
    await p.run({ update: true });
    const next = p.commit(spec("/replacement"));
    p.configure(next, config);
    await p.run({ update: true });
    expect(existsSync(join(p.cwd, "packages/utils/functions/old/GET.ts"))).toBe(
      false
    );
    expect(existsSync(join(p.cwd, "packages/types/api/old/GET.d.ts"))).toBe(
      false
    );
    expect((await p.run({ check: true })).changed).toEqual([]);
  });

  it("reads the exact commit despite dirty worktree and newer HEAD, with portable repository environment configuration", async () => {
    const p = setup();
    p.commit(spec("/newer"));
    writeFileSync(join(p.backend, "api.json"), "dirty invalid JSON");
    process.env["TYPEFORGE_TEST_REPO"] = p.backend;
    p.configure(p.revision, "", "${TYPEFORGE_TEST_REPO}");
    await p.run({ update: true });
    expect(readFileSync(join(p.sourceDir, "spec.json"), "utf8")).toBe(spec());
    const receipt = JSON.parse(
      readFileSync(join(p.sourceDir, "typeforge.provenance.json"), "utf8")
    );
    expect(receipt.source.commit).toBe(p.revision);
    expect(receipt.rawSha256).toBe(sha256(spec()));
    expect(readdirSync(p.sourceDir).toSorted()).toEqual([
      "generated",
      "source.ts",
      "spec.json",
      "typeforge.provenance.json",
    ]);
    const before = snapshot(p.root);
    expect((await p.run({ check: true })).changed).toEqual([]);
    expect(snapshot(p.root)).toEqual(before);
  });

  it("requires explicit initialization and source revision updates", async () => {
    const p = setup();
    const before = snapshot(p.root);
    await expect(p.run({ check: true })).rejects.toThrow(/Provenance drift/);
    expect(snapshot(p.root)).toEqual(before);
    await p.run({ update: true });
    const newer = p.commit(spec("/renamed"));
    p.configure(newer);
    const pinned = snapshot(p.root);
    await expect(p.run()).rejects.toThrow(/Provenance drift/);
    await expect(p.run({ check: true })).rejects.toThrow(/Provenance drift/);
    expect(snapshot(p.root)).toEqual(pinned);
    await p.run({ update: true });
    expect(
      existsSync(join(p.sourceDir, "generated/functions/old/GET.ts"))
    ).toBe(false);
    expect(
      existsSync(join(p.sourceDir, "generated/functions/renamed/GET.ts"))
    ).toBe(true);
    expect((await p.run({ check: true })).changed).toEqual([]);
  });

  it.each([
    "hash",
    "missing-commit",
    "branch",
    "missing-path",
    "invalid-json",
    "invalid-spec",
  ])(
    "fails %s acquisition or validation without partial writes",
    async (kind) => {
      const p = setup();
      await p.run({ update: true });
      if (kind === "hash") {
        const path = join(p.sourceDir, "typeforge.provenance.json");
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace(
            /"rawSha256": "[a-f0-9]+"/,
            '"rawSha256": "bad"'
          )
        );
      }
      if (kind === "missing-commit") {
        p.configure("f".repeat(40));
      }
      if (kind === "branch") {
        p.configure("HEAD");
      }
      if (kind === "missing-path") {
        const path = join(p.sourceDir, "source.ts");
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace("api.json", "missing.json")
        );
      }
      if (kind === "invalid-json" || kind === "invalid-spec") {
        p.configure(p.commit(kind === "invalid-json" ? "{" : "{}"));
      }
      const before = snapshot(p.root);
      await expect(p.run({ check: true })).rejects.toThrow(/.+/);
      await expect(
        p.run({ update: kind === "invalid-json" || kind === "invalid-spec" })
      ).rejects.toThrow(/.+/);
      expect(snapshot(p.root)).toEqual(before);
    }
  );

  it("reports snapshot, missing and changed output drift without writing, and repairs from pinned objects", async () => {
    const p = setup();
    await p.run({ update: true });
    writeFileSync(join(p.sourceDir, "spec.json"), "{}");
    rmSync(join(p.sourceDir, "generated/types"), { recursive: true });
    const runtime = join(p.sourceDir, "generated/runtime.ts");
    writeFileSync(runtime, `${readFileSync(runtime, "utf8")}// edited\n`);
    const before = snapshot(p.root);
    const result = await p.run({ check: true });
    expect(result.changed).toContain(join(p.sourceDir, "spec.json"));
    expect(result.changed).toContain(runtime);
    expect(
      result.changed.some((path) => path.includes("types/old/GET.d.ts"))
    ).toBe(true);
    expect(snapshot(p.root)).toEqual(before);
    await p.run();
    expect((await p.run({ check: true })).changed).toEqual([]);
  });

  it("detects and removes obsolete marked types/functions, preserving handwritten files and other owners", async () => {
    const p = setup();
    await p.run({ update: true });
    // A restored or copied owned file must not disappear from drift detection.
    const generated = join(p.sourceDir, "generated");
    const stale = join(generated, "obsolete.ts");
    writeFileSync(stale, readFileSync(join(generated, "runtime.ts")));
    const handwritten = join(generated, "manual.ts");
    writeFileSync(handwritten, "export const manual = true;\n");
    const other = join(generated, "other.ts");
    writeFileSync(
      other,
      readFileSync(stale, "utf8").replace("src%2Fapi%2Ftest", "another-owner")
    );
    const before = snapshot(p.root);
    const checked = await p.run({ check: true });
    expect(checked.obsolete).toContain(stale);
    expect(snapshot(p.root)).toEqual(before);
    await p.run();
    expect(existsSync(stale)).toBe(false);
    expect(existsSync(handwritten)).toBe(true);
    expect(existsSync(other)).toBe(true);
    const empty = p.commit(JSON.stringify({ openapi: "3.0.3", paths: {} }));
    p.configure(empty);
    await p.run({ update: true });
    expect(existsSync(join(generated, "functions/old/GET.ts"))).toBe(false);
    expect(existsSync(join(generated, "types/old/GET.d.ts"))).toBe(false);
  });

  it("protects edited obsolete files and unowned collisions before any writes", async () => {
    const p = setup();
    await p.run({ update: true });
    const old = join(p.sourceDir, "generated/functions/old/GET.ts");
    writeFileSync(old, `${readFileSync(old, "utf8")}// manual edit\n`);
    const revision = p.commit(spec("/next"));
    p.configure(revision);
    const before = snapshot(p.root);
    await expect(p.run({ update: true })).rejects.toThrow(/Refusing/);
    expect(snapshot(p.root)).toEqual(before);
    p.configure(p.revision);
    writeFileSync(old, "// handwritten replacement\n");
    const replaced = snapshot(p.root);
    expect((await p.run({ check: true })).conflicts).toContain(old);
    await expect(p.run()).rejects.toThrow(/Refusing/);
    expect(snapshot(p.root)).toEqual(replaced);
  });

  it("preserves removed endpoint output in merge mode", async () => {
    const p = setup();
    p.configure(p.revision, 'generationMode: "merge"');
    await p.run({ update: true });
    const next = p.commit(spec("/new"));
    p.configure(next, 'generationMode: "merge"');
    await p.run({ update: true });
    expect(
      existsSync(join(p.sourceDir, "generated/functions/old/GET.ts"))
    ).toBe(true);
    expect(
      readFileSync(join(p.sourceDir, "generated/routes.ts"), "utf8")
    ).toContain("/old");
    expect((await p.run({ check: true })).changed).toEqual([]);
  });

  it("keeps fresh successful and failing checks read-only, including forbidden mutation options", async () => {
    const p = setup();
    writeFileSync(join(p.sourceDir, "source.ts"), "export default {}");
    writeFileSync(join(p.sourceDir, "spec.json"), spec());
    const before = snapshot(p.root);
    const result = await p.run({ check: true });
    expect(result.changed.length).toBeGreaterThan(0);
    expect(snapshot(p.root)).toEqual(before);
    for (const options of [
      { check: true, update: true },
      { check: true, acceptBase: true },
    ]) {
      await expect(p.run(options)).rejects.toThrow(/--check/);
    }
    expect(snapshot(p.root)).toEqual(before);
    await p.run();
    const after = snapshot(p.root);
    expect((await p.run({ check: true })).changed).toEqual([]);
    expect(snapshot(p.root)).toEqual(after);
  });

  it("prepares every source before --all mutates anything and exits nonzero for drift", async () => {
    const p = setup();
    await p.run({ update: true });
    writeFileSync(join(p.sourceDir, "spec.json"), "{}");
    const second = join(p.cwd, "src/api/bad");
    mkdirSync(second);
    writeFileSync(join(second, "source.ts"), "export default {}");
    writeFileSync(join(second, "spec.json"), "{");
    const before = snapshot(p.root);
    for (const args of [
      ["generate", "--all"],
      ["generate", "--all", "--check"],
      ["update", "--all", "--check"],
    ]) {
      const result = spawnSync(process.execPath, [cli, ...args], {
        cwd: p.cwd,
        encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(snapshot(p.root)).toEqual(before);
    }
  });

  it("rejects symlinked output directories", async () => {
    const p = setup();
    const outside = join(p.root, "outside");
    mkdirSync(outside);
    symlinkSync(outside, join(p.sourceDir, "generated"));
    await expect(p.run({ update: true })).rejects.toThrow(/Symlink/);
    expect(readdirSync(outside)).toEqual([]);
  });

  it("retains project-relative file and HTTP URL spec support", async () => {
    const p = setup();
    writeFileSync(join(p.cwd, "input.json"), spec());
    writeFileSync(
      join(p.sourceDir, "source.ts"),
      'export default { spec: "input.json" }'
    );
    await p.run();
    expect((await p.run({ check: true })).changed).toEqual([]);
    const server = createServer((_req, res) => {
      res.end(spec());
    });
    await new Promise<void>((done, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", done);
    });
    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("No listener");
      }
      writeFileSync(
        join(p.sourceDir, "source.ts"),
        `export default { spec: "http://127.0.0.1:${address.port}/spec" }`
      );
      expect((await p.run({ check: true })).changed).toEqual([]);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done()))
      );
    }
  });
});
