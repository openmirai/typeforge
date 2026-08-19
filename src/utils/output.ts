import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface OutputFile {
  path: string;
  content: string;
}

export async function writeOutputFiles(
  files: Array<OutputFile>,
  check = false
): Promise<{ written: number; changed: Array<string> }> {
  const changed: Array<string> = [];

  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true });

    let existing: string | undefined;
    try {
      existing = await readFile(file.path, "utf8");
    } catch {
      existing = undefined;
    }

    if (existing === file.content) {
      continue;
    }

    changed.push(file.path);
    if (!check) {
      await writeFile(file.path, file.content, "utf8");
    }
  }

  return { changed, written: check ? 0 : changed.length };
}

export async function clearGeneratedDir(
  generatedDir: string,
  preserve: Array<string> = []
): Promise<void> {
  const preserveSet = new Set(
    preserve.map((entry) => join(generatedDir, entry))
  );

  try {
    await rm(generatedDir, { force: true, recursive: true });
  } catch {
    // Directory may not exist yet.
  }

  for (const file of preserveSet) {
    await mkdir(dirname(file), { recursive: true });
  }
}
