import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import * as fs from "node:fs/promises";

import { clearGeneratedDir, writeOutputFiles } from "../output";

describe("output utils edge cases", () => {
  it("rolls back content and new directories when a write fails", async () => {
    const root = await mkdtemp(join(tmpdir(), "typeforge-rollback-"));
    const existing = join(root, "existing.ts");
    await writeFile(existing, "original");
    const blocked = join(root, "blocked");
    await mkdir(blocked);
    await fs.chmod(blocked, 0o500);
    try {
      await expect(
        writeOutputFiles([
          { path: existing, content: "replacement" },
          { path: join(root, "new/nested/output.ts"), content: "new" },
          { path: join(blocked, "output.ts"), content: "blocked" },
        ])
      ).rejects.toThrow(/EACCES|EPERM/);
      expect(await readFile(existing, "utf8")).toBe("original");
      expect(await fs.readdir(root)).toEqual(["blocked", "existing.ts"]);
    } finally {
      await fs.chmod(blocked, 0o700);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("preserves selected files when clearing generated output", async () => {
    const root = await mkdtemp(join(tmpdir(), "codegen-output-"));
    const generated = join(root, "generated");
    const keepPath = join(generated, "keep.txt");

    await mkdir(generated, { recursive: true });
    await writeFile(keepPath, "keep-me", "utf8");

    await clearGeneratedDir(generated, ["keep.txt"]);
    await writeFile(keepPath, "keep-me", "utf8");

    expect(await readFile(keepPath, "utf8")).toBe("keep-me");
    await rm(root, { force: true, recursive: true });
  });

  it("reports changed files in check mode without writing", async () => {
    const root = await mkdtemp(join(tmpdir(), "codegen-check-"));
    const filePath = join(root, "routes.ts");

    const result = await writeOutputFiles(
      [{ content: "export const Routes = {} as const;\n", path: filePath }],
      true
    );

    expect(result.changed).toEqual([filePath]);
    expect(result.written).toBe(0);
    await expect(readFile(filePath, "utf8")).rejects.toThrow("ENOENT");
    await rm(root, { force: true, recursive: true });
  });
});
