import type { SourceConfig } from "./types";

/**
 * Identity helper for `source.ts`. Use it so the object is checked against
 * `SourceConfig` and editors can autocomplete fields.
 */
export function defineSourceConfig(config: SourceConfig): SourceConfig {
  return config;
}
