import { describe, expect, it } from "vitest";

import type { QueryExtendsConfig } from "../../../config/types";
import type { JsonObject } from "../../../json/types";
import { emitTypeFiles } from "../index";
import { parseSpec } from "../../../parser/index";

interface QueryParam {
  name: string;
  schema: JsonObject;
}

const queryExtends: QueryExtendsConfig = {
  limit: "limit",
  page: "page",
  paginationImportPath: "./common",
  paginationTypeName: "PaginationParams",
  sortBy: "sortBy",
  sortImportPath: "./common",
  sortOrder: "sortOrder",
  sortTypeName: "SortParams",
};

function emitParams(
  params: Array<QueryParam>,
  config: QueryExtendsConfig | undefined = queryExtends
): string {
  const source = parseSpec(
    {
      openapi: "3.1.0",
      info: { title: "t", version: "1" },
      paths: {
        "/api/v2/customers": {
          get: {
            parameters: params.map((param) => ({ ...param, in: "query" })),
            responses: { "200": { description: "ok" } },
          },
        },
      },
    },
    { pathPrefix: "/api/v2/" }
  );
  const files = emitTypeFiles({
    baseFile: "/project/generated/base.ts",
    envelopeMode: "raw",
    ...(config === undefined ? {} : { queryExtends: config }),
    source,
    typesDir: "/project/generated/types",
  });
  const content = files[0]?.content ?? "";
  const start = content.indexOf("export ");
  const end = content.indexOf("\n\n", start);
  return content.slice(start, end === -1 ? undefined : end);
}

const string = { type: "string" };
const integer = { type: "integer" };

describe("query params folding into queryExtends types", () => {
  it("keeps string sort params inline and every field around them", () => {
    const params = emitParams([
      { name: "page", schema: integer },
      { name: "limit", schema: integer },
      { name: "email", schema: string },
      { name: "subscriptionTier", schema: string },
      { name: "sortBy", schema: { default: "createdAt", type: "string" } },
      { name: "sortOrder", schema: { default: "desc", type: "string" } },
      { name: "startDate", schema: string },
      { name: "endDate", schema: string },
    ]);

    expect(params).toBe(
      [
        "export interface GETApiV2CustomersParams extends PaginationParams {",
        "  email?: string;",
        "  subscriptionTier?: string;",
        "  sortBy?: string;",
        "  sortOrder?: string;",
        "  startDate?: string;",
        "  endDate?: string;",
        "}",
      ].join("\n")
    );
  });

  it("folds an enum sort field and its direction into the sort type", () => {
    const params = emitParams([
      { name: "page", schema: integer },
      { name: "limit", schema: integer },
      { name: "search", schema: string },
      {
        name: "sortBy",
        schema: { enum: ["name", "createdAt"], type: "string" },
      },
      { name: "sortOrder", schema: { enum: ["asc", "desc"], type: "string" } },
      { name: "status", schema: string },
    ]);

    expect(params).toBe(
      [
        'export interface GETApiV2CustomersParams extends SortParams<"name" | "createdAt">, PaginationParams {',
        "  search?: string;",
        "  status?: string;",
        "}",
      ].join("\n")
    );
  });

  it("aliases the shared types when no other field is left", () => {
    const params = emitParams([
      { name: "page", schema: integer },
      { name: "limit", schema: integer },
      { name: "sortBy", schema: { enum: ["name"], type: "string" } },
      { name: "sortOrder", schema: string },
    ]);

    expect(params).toBe(
      'export type GETApiV2CustomersParams = SortParams<"name"> & PaginationParams;'
    );
  });

  it("emits every field when there are no sort params", () => {
    const params = emitParams([
      { name: "search", schema: string },
      { name: "page", schema: integer },
      { name: "limit", schema: integer },
      { name: "status", schema: string },
    ]);

    expect(params).toBe(
      [
        "export interface GETApiV2CustomersParams extends PaginationParams {",
        "  search?: string;",
        "  status?: string;",
        "}",
      ].join("\n")
    );
  });

  it("keeps params inline when no shared type is configured for them", () => {
    const params = emitParams(
      [
        { name: "page", schema: integer },
        { name: "limit", schema: integer },
        { name: "sortBy", schema: { enum: ["name"], type: "string" } },
        { name: "sortOrder", schema: string },
      ],
      { limit: "limit", page: "page", sortBy: "sortBy", sortOrder: "sortOrder" }
    );

    expect(params).toBe(
      [
        "export interface GETApiV2CustomersParams {",
        "  page?: number;",
        "  limit?: number;",
        '  sortBy?: "name";',
        "  sortOrder?: string;",
        "}",
      ].join("\n")
    );
  });

  it("keeps a sort field inline when its direction is absent", () => {
    const params = emitParams([
      { name: "sortBy", schema: { enum: ["name"], type: "string" } },
      { name: "q", schema: string },
    ]);

    expect(params).toBe(
      [
        "export interface GETApiV2CustomersParams {",
        '  sortBy?: "name";',
        "  q?: string;",
        "}",
      ].join("\n")
    );
  });
});
