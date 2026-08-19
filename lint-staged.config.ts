import type { Configuration } from "lint-staged";

const isGeneratedArtifact = (file: string): boolean => {
  const normalized = file.replaceAll("\\", "/");

  return (
    normalized.includes("/dist/") ||
    normalized.includes("/test/fixtures/") ||
    normalized.includes("/test/snapshots/") ||
    normalized.includes("/generated/")
  );
};

const applicationFiles = (files: ReadonlyArray<string>): Array<string> =>
  files.filter((file) => !isGeneratedArtifact(file));

const quotedFiles = (files: ReadonlyArray<string>): string =>
  files.map((file) => JSON.stringify(file)).join(" ");

const filesToCommand = (
  files: ReadonlyArray<string>,
  command: (paths: string) => Array<string>
): Array<string> => {
  const filesToCheck = applicationFiles(files);

  if (filesToCheck.length === 0) {
    return [];
  }

  return command(quotedFiles(filesToCheck));
};

const jsTsTasks = (files: ReadonlyArray<string>): Array<string> =>
  filesToCommand(files, (paths) => [
    `pnpm exec oxlint --fix --quiet ${paths}`,
    `pnpm exec oxfmt --write ${paths}`,
  ]);

const formatTasks = (files: ReadonlyArray<string>): Array<string> =>
  filesToCommand(files, (paths) => [`pnpm exec oxfmt --write ${paths}`]);

const configuration = {
  "**/*.{js,jsx,mjs,cjs,ts,tsx}": jsTsTasks,
  "**/*.{json,jsonc}": formatTasks,
} satisfies Configuration;

export default configuration;
