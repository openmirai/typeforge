import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: [
        "src/cli.ts",
        "test/**",
        "**/*.d.ts",
        "**/__fixtures__/**",
        "**/generated/**",
      ],
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "json-summary", "json", "lcov"],
      reportsDirectory: "./coverage",
      thresholds: {
        branches: 88,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
    include: ["src/**/__tests__/**/*.test.ts", "test/**/*.test.ts"],
  },
});
