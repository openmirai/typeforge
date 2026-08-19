import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runCli(
  cwd: string,
  args: Array<string>,
  env: Record<string, string | undefined> = {}
): CliResult {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1", ...env },
    });
    return { exitCode: 0, stderr: "", stdout };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      "stdout" in error &&
      "stderr" in error
    ) {
      return {
        exitCode: typeof error.status === "number" ? error.status : 1,
        stderr: String(error.stderr),
        stdout: String(error.stdout),
      };
    }
    throw error;
  }
}
