import { defineConfig } from "tsdown";

const shared = {
  deps: {
    neverBundle: true,
  },
  dts: {
    sourcemap: true,
  },
  fixedExtension: false,
  format: "esm",
  outDir: "dist",
  sourcemap: true,
  target: "es2022",
  treeshake: true,
  tsconfig: "tsconfig.json",
} as const;

export default defineConfig([
  {
    ...shared,
    entry: { cli: "src/cli.ts", index: "src/index.ts" },
    name: "@openmirai/openapi-codegen",
    platform: "node",
  },
  {
    ...shared,
    entry: { index: "src/adapters/axios/index.ts" },
    name: "@openmirai/openapi-codegen/adapters/axios",
    outDir: "dist/adapters/axios",
    platform: "node",
  },
  {
    ...shared,
    entry: { index: "src/adapters/fetch/index.ts" },
    name: "@openmirai/openapi-codegen/adapters/fetch",
    outDir: "dist/adapters/fetch",
    platform: "neutral",
  },
  {
    ...shared,
    entry: { types: "src/http/types.ts", validate: "src/http/validate.ts" },
    name: "@openmirai/openapi-codegen/http",
    outDir: "dist/http",
    platform: "neutral",
  },
  {
    ...shared,
    entry: { zod: "src/validation/zod.ts" },
    name: "@openmirai/openapi-codegen/validation/zod",
    outDir: "dist/validation",
    platform: "neutral",
  },
  {
    ...shared,
    entry: { index: "src/routes/index.ts" },
    name: "@openmirai/openapi-codegen/routes",
    outDir: "dist/routes",
    platform: "neutral",
  },
]);
