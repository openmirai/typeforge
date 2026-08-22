import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const rootTypesPath = "./dist/index.d.ts";

if (manifest.types !== rootTypesPath) {
  throw new Error(
    `package.json types must point to ${rootTypesPath}; received ${String(manifest.types)}`
  );
}
if (manifest.exports?.["."]?.types !== rootTypesPath) {
  throw new Error(
    `package.json exports["."].types must point to ${rootTypesPath}`
  );
}

const output = execFileSync(
  "npm",
  ["pack", "--dry-run", "--json", "--ignore-scripts"],
  { encoding: "utf8" }
);
const [pack] = JSON.parse(output);

if (pack === undefined) {
  throw new Error("npm pack did not return package metadata");
}

const paths = pack.files.map((file) => file.path);
const unexpected = paths.filter(
  (path) =>
    path !== "README.md" && path !== "package.json" && !path.startsWith("dist/")
);
const sourceMaps = paths.filter((path) => path.endsWith(".map"));

if (!paths.includes(rootTypesPath.slice(2))) {
  throw new Error(`Package is missing its root declaration: ${rootTypesPath}`);
}

if (unexpected.length > 0) {
  throw new Error(`Unexpected package files: ${unexpected.join(", ")}`);
}
if (sourceMaps.length > 0) {
  throw new Error(
    `Source maps must not be published: ${sourceMaps.join(", ")}`
  );
}
if (pack.entryCount > 20) {
  throw new Error(
    `Package contains ${pack.entryCount} files; expected at most 20`
  );
}
if (pack.size > 75_000) {
  throw new Error(
    `Package tarball is ${pack.size} bytes; expected at most 75000`
  );
}
if (pack.unpackedSize > 125_000) {
  throw new Error(
    `Package is ${pack.unpackedSize} unpacked bytes; expected at most 125000`
  );
}

process.stdout.write(
  `typeforge package: ${pack.size} packed bytes, ${pack.unpackedSize} unpacked bytes, ${pack.entryCount} files\n`
);
