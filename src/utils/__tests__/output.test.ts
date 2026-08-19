import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { clearGeneratedDir, writeOutputFiles } from "../output";

describe("writeOutputFiles", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("writes new files and reports changed paths", async () => {
    const root = join(
      process.cwd(),
      "test/fixtures/layouts",
      `out-${Date.now()}`
    );
    tempRoots.push(root);
    const target = join(root, "nested/file.ts");

    const result = await writeOutputFiles([
      { content: "export const x = 1;\n", path: target },
    ]);

    expect(result.written).toBe(1);
    expect(result.changed).toEqual([target]);
    expect(readFileSync(target, "utf8")).toBe("export const x = 1;\n");
  });

  it("skips unchanged files", async () => {
    const root = join(
      process.cwd(),
      "test/fixtures/layouts",
      `out-skip-${Date.now()}`
    );
    tempRoots.push(root);
    mkdirSync(root, { recursive: true });
    const target = join(root, "same.ts");
    writeFileSync(target, "same\n", "utf8");

    const result = await writeOutputFiles([
      { content: "same\n", path: target },
    ]);
    expect(result.changed).toEqual([]);
    expect(result.written).toBe(0);
  });

  it("check mode reports changes without writing", async () => {
    const root = join(
      process.cwd(),
      "test/fixtures/layouts",
      `out-check-${Date.now()}`
    );
    tempRoots.push(root);
    mkdirSync(root, { recursive: true });
    const target = join(root, "stale.ts");
    writeFileSync(target, "old\n", "utf8");

    const result = await writeOutputFiles(
      [{ content: "new\n", path: target }],
      true
    );
    expect(result.changed).toEqual([target]);
    expect(result.written).toBe(0);
    expect(readFileSync(target, "utf8")).toBe("old\n");
  });
});

describe("clearGeneratedDir", () => {
  const tempRoots: Array<string> = [];

  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots.length = 0;
  });

  it("removes generated directory contents", async () => {
    const root = join(
      process.cwd(),
      "test/fixtures/layouts",
      `clear-${Date.now()}`
    );
    tempRoots.push(root);
    const generated = join(root, "generated");
    mkdirSync(generated, { recursive: true });
    writeFileSync(join(generated, "routes.ts"), "// old\n", "utf8");

    await clearGeneratedDir(generated);
    expect(() => readFileSync(join(generated, "routes.ts"), "utf8")).toThrow(
      /ENOENT/
    );
  });
});
