import { describe, expect, it } from "vitest";
import { parseSpec } from "../index";

const spec = {
  definitions: {
    Category: {
      properties: {
        id: { type: "integer" },
        name: { type: "string" },
      },
      type: "object",
    },
    CategoryResponse: {
      properties: {
        data: { $ref: "#/definitions/Category" },
        message: { type: "string" },
        success: { type: "boolean" },
      },
      required: ["success", "data"],
      type: "object",
    },
    UpdateCategoryBody: {
      properties: {
        name: { type: "string" },
      },
      type: "object",
    },
  },
  info: { title: "Test API", version: "1.0" },
  paths: {
    "/api/orbit/v1/segments/{token}": {
      get: {
        operationId: "getCategory",
        parameters: [
          { name: "expand", in: "query", required: false, type: "string" },
          { name: "verbose", in: "query", required: true, type: "boolean" },
        ],
        responses: {
          "200": { schema: { $ref: "#/definitions/CategoryResponse" } },
          "404": { description: "Not found" },
        },
      },
      parameters: [
        { name: "token", in: "path", required: true, type: "integer" },
      ],
      put: {
        operationId: "updateCategory",
        parameters: [
          {
            name: "body",
            in: "body",
            required: true,
            schema: { $ref: "#/definitions/UpdateCategoryBody" },
          },
        ],
        responses: {
          "200": { schema: { $ref: "#/definitions/CategoryResponse" } },
        },
      },
    },
    "/api/orbit/v1/health": {
      get: {
        operationId: "healthCheck",
        responses: {
          "200": {
            schema: {
              properties: { status: { type: "string" } },
              type: "object",
            },
          },
        },
      },
    },
  },
  swagger: "2.0",
};

describe("parseSpec - Swagger 2", () => {
  it("returns an IRSource with empty key", () => {
    const result = parseSpec(spec, {});
    expect(typeof result.key).toBe("string");
  });

  it("parses both paths", () => {
    const result = parseSpec(spec, {});
    expect(result.paths).toHaveLength(2);
  });

  it("parses path string", () => {
    const result = parseSpec(spec, {}),
      catPath = result.paths.find((p) => p.path.includes("segments"))!;
    expect(catPath.path).toBe("/api/orbit/v1/segments/{token}");
  });

  it("converts path params to cleanPath bracket notation", () => {
    const result = parseSpec(spec, {}),
      catPath = result.paths.find((p) => p.path.includes("segments"))!;
    expect(catPath.cleanPath).toBe("api/orbit/v1/segments/[token]");
  });

  it("strips leading slash in cleanPath for static path", () => {
    const result = parseSpec(spec, {}),
      healthPath = result.paths.find((p) => p.path.includes("health"))!;
    expect(healthPath.cleanPath).toBe("api/orbit/v1/health");
  });

  it("parses GET operation with operationId", () => {
    const result = parseSpec(spec, {}),
      ops = result.paths.find((p) => p.path.includes("segments"))!.operations,
      get = ops.find((o) => o.method === "get")!;
    expect(get.operationId).toBe("getCategory");
    expect(get.method).toBe("get");
  });

  it("inherits path-level params into GET operation", () => {
    const result = parseSpec(spec, {}),
      ops = result.paths.find((p) => p.path.includes("segments"))!.operations,
      get = ops.find((o) => o.method === "get")!;
    expect(get.pathParams).toHaveLength(1);
    expect(get.pathParams[0]!.name).toBe("token");
  });

  it("maps integer type to IRSchema kind:number", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "get")!;
    expect(get.pathParams[0]!.schema.kind).toBe("number");
  });

  it("parses query params with required flag", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "get")!;
    expect(get.queryParams).toHaveLength(2);
    const expand = get.queryParams.find((q) => q.name === "expand")!;
    expect(expand.required).toBe(false);
    expect(expand.schema.kind).toBe("string");
    const verbose = get.queryParams.find((q) => q.name === "verbose")!;
    expect(verbose.required).toBe(true);
    expect(verbose.schema.kind).toBe("boolean");
  });

  it("parses response $ref as kind:ref with correct name", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "get")!,
      resp200 = get.responses.find((r) => r.statusCode === "200")!;
    expect(resp200.schema?.kind).toBe("ref");
    expect(resp200.schema?.ref).toBe("CategoryResponse");
  });

  it("parses 404 response without schema", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "get")!,
      resp404 = get.responses.find((r) => r.statusCode === "404");
    expect(resp404).toBeDefined();
    expect(resp404?.schema).toBeUndefined();
  });

  it("parses PUT request body from in:body param", () => {
    const result = parseSpec(spec, {}),
      put = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "put")!;
    expect(put.requestBody).toBeDefined();
    expect(put.requestBody!.required).toBe(true);
    expect(put.requestBody!.schema.kind).toBe("ref");
    expect(put.requestBody!.schema.ref).toBe("UpdateCategoryBody");
  });

  it("GET has no requestBody", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("segments"))!
        .operations.find((o) => o.method === "get")!;
    expect(get.requestBody).toBeUndefined();
  });

  it("parses components.schemas from definitions", () => {
    const result = parseSpec(spec, {});
    expect(result.components.schemas).toHaveProperty("CategoryResponse");
    expect(result.components.schemas).toHaveProperty("Category");
    expect(result.components.schemas).toHaveProperty("UpdateCategoryBody");
  });

  it("parses object schema with required fields", () => {
    const result = parseSpec(spec, {}),
      catResp = result.components.schemas["CategoryResponse"]!;
    expect(catResp.kind).toBe("object");
    expect(catResp.required).toContain("success");
    expect(catResp.required).toContain("data");
  });

  it("marks required properties on IRSchemaProperty", () => {
    const result = parseSpec(spec, {}),
      catResp = result.components.schemas["CategoryResponse"]!;
    expect(catResp.properties?.["success"]?.required).toBe(true);
    expect(catResp.properties?.["data"]?.required).toBe(true);
    expect(catResp.properties?.["message"]?.required).toBe(false);
  });

  it("parses $ref in schema properties", () => {
    const result = parseSpec(spec, {}),
      catResp = result.components.schemas["CategoryResponse"]!;
    expect(catResp.properties?.["data"]?.schema.kind).toBe("ref");
    expect(catResp.properties?.["data"]?.schema.ref).toBe("Category");
  });

  it("filters paths by pathPrefix", () => {
    const result = parseSpec(spec, { pathPrefix: "/api/orbit/v1/segments" });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]!.path).toContain("segments");
  });

  it("returns empty paths when no paths match prefix", () => {
    const result = parseSpec(spec, { pathPrefix: "/api/nova/v2" });
    expect(result.paths).toHaveLength(0);
  });

  it("excludes paths in ignorePaths", () => {
    const result = parseSpec(spec, { ignorePaths: ["/api/orbit/v1/health"] });
    expect(result.paths.every((p) => !p.path.includes("health"))).toBe(true);
  });

  it("returns empty IRSource for non-object input", () => {
    const result = parseSpec(null, {});
    expect(result.paths).toHaveLength(0);
    expect(result.components.schemas).toEqual({});
  });

  it("returns empty IRSource for unrecognised spec version", () => {
    const result = parseSpec({ openapi: "2.0", paths: {} }, {});
    expect(result.paths).toHaveLength(0);
  });
});
