import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

import { clearGeneratedDir, writeOutputFiles } from "../output";

describe("output utils edge cases", () => {
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
