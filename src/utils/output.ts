import { lstat, mkdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface OutputFile {
  path: string;
  content: string;
}

/** Preflight all reads before mutation; roll back ordinary write failures. */
export async function writeOutputFiles(
  files: Array<OutputFile>,
  check = false,
  obsolete: Array<string> = []
): Promise<{ written: number; changed: Array<string> }> {
  const targets = new Map<string, string | undefined>();
  for (const file of files) {
    if (targets.has(file.path)) {
      throw new Error(`Conflicting output ownership: ${file.path}`);
    }
    targets.set(file.path, file.content);
  }
  for (const path of obsolete) {
    if (targets.has(path)) {
      throw new Error(`Conflicting output ownership: ${path}`);
    }
    targets.set(path, undefined);
  }
  const originals = new Map<string, string | undefined>();
  const changed: Array<string> = [];
  for (const [path, content] of targets) {
    let existing: string | undefined;
    try {
      const stat = await lstat(path);
      if (!stat.isFile()) {
        throw new Error(`Output is not a regular file: ${path}`);
      }
      existing = await readFile(path, "utf8");
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
    }
    originals.set(path, existing);
    if (existing !== content) {
      changed.push(path);
    }
  }
  if (check) {
    return { changed, written: 0 };
  }

  const createdDirs: Array<string> = [];
  const touched: Array<string> = [];
  const ensureDir = async (path: string): Promise<void> => {
    try {
      const stat = await lstat(path);
      if (!stat.isDirectory()) {
        throw new Error(`Output parent is not a directory: ${path}`);
      }
    } catch (error) {
      if (!isMissing(error)) {
        throw error;
      }
      await ensureDir(dirname(path));
      await mkdir(path);
      createdDirs.push(path);
    }
  };
  try {
    for (const path of changed) {
      const content = targets.get(path);
      await ensureDir(dirname(path));
      touched.push(path);
      if (content === undefined) {
        await rm(path);
      } else {
        await writeFile(path, content, "utf8");
      }
    }
  } catch (error) {
    for (const path of touched.toReversed()) {
      const original = originals.get(path);
      if (original === undefined) {
        await rm(path, { force: true });
      } else {
        await writeFile(path, original, "utf8");
      }
    }
    for (const path of createdDirs.toReversed()) {
      await rmdir(path);
    }
    throw error;
  }
  return { changed, written: changed.length };
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
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
