/** Fictional API surface used by tests — not copied from OpenMirai repos. */
export const ENVELOPE_PREFIX = "/api/acme/v3";
export const RAW_PREFIX = "/api/orbit/v1";

export const SOURCE_ATLAS = "atlas";
export const SOURCE_ORBIT = "orbit";
export const SOURCE_NOVA = "nova";

export const DEFAULT_SOURCE_CONFIG = `export default {
  pathPrefix: "${ENVELOPE_PREFIX}",
  stripApiPrefix: true,
  generationMode: "authoritative" as const,
};`;

export const WIDGETS_PATH = `${ENVELOPE_PREFIX}/widgets`;
export const WIDGET_BY_SLUG_PATH = `${ENVELOPE_PREFIX}/widgets/{slug}`;
