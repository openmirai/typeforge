import { describe, expect, it } from "vitest";
import { parseSpec } from "../index";

const spec = {
  components: {
    schemas: {
      CreateItemBodyA: {
        properties: {
          kind: { enum: ["A"], type: "string" },
          name: { type: "string" },
        },
        type: "object",
      },
      CreateItemBodyB: {
        properties: {
          kind: { enum: ["B"], type: "string" },
          name: { type: "string" },
        },
        type: "object",
      },
      Item: {
        properties: {
          count: { type: "integer" },
          id: { format: "uuid", type: "string" },
          name: { type: "string" },
          tags: { items: { type: "string" }, type: "array" },
        },
        required: ["id", "name"],
        type: "object",
      },
      ItemListResponse: {
        properties: {
          data: { items: { $ref: "#/components/schemas/Item" }, type: "array" },
          total: { type: "integer" },
        },
        type: "object",
      },
      NullableField: {
        properties: {
          value: { nullable: true, type: "string" },
        },
        type: "object",
      },
    },
  },
  info: { title: "Items API", version: "1.0" },
  openapi: "3.0.0",
  paths: {
    "/api/acme/v3/widgets": {
      get: {
        operationId: "listWidgets",
        parameters: [
          {
            in: "query",
            name: "page",
            required: false,
            schema: { type: "integer" },
          },
          {
            in: "query",
            name: "limit",
            required: true,
            schema: { type: "integer" },
          },
          {
            in: "query",
            name: "search",
            required: false,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ItemListResponse" },
              },
            },
          },
        },
      },
      post: {
        operationId: "createItem",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                oneOf: [
                  { $ref: "#/components/schemas/CreateItemBodyA" },
                  { $ref: "#/components/schemas/CreateItemBodyB" },
                ],
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
        },
      },
    },
    "/api/acme/v3/widgets/{slug}": {
      delete: {
        operationId: "deleteItem",
        responses: { "204": {} },
      },
      get: {
        operationId: "getItem",
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Item" },
              },
            },
          },
          "404": {},
        },
      },
      parameters: [
        {
          in: "path",
          name: "slug",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
    },
  },
};

describe("parseSpec - OpenAPI 3", () => {
  it("parses both paths", () => {
    const result = parseSpec(spec, {});
    expect(result.paths).toHaveLength(2);
  });

  it("parses static cleanPath", () => {
    const result = parseSpec(spec, {}),
      items = result.paths.find((p) => p.path === "/api/acme/v3/widgets")!;
    expect(items.cleanPath).toBe("api/acme/v3/widgets");
  });

  it("parses dynamic cleanPath", () => {
    const result = parseSpec(spec, {}),
      item = result.paths.find((p) => p.path.includes("{slug}"))!;
    expect(item.cleanPath).toBe("api/acme/v3/widgets/[slug]");
  });

  it("parses query params on GET", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path === "/api/acme/v3/widgets")!
        .operations.find((o) => o.method === "get")!;
    expect(get.queryParams).toHaveLength(3);
    const page = get.queryParams.find((q) => q.name === "page")!;
    expect(page.required).toBe(false);
    expect(page.schema.kind).toBe("number");
    const limit = get.queryParams.find((q) => q.name === "limit")!;
    expect(limit.required).toBe(true);
  });

  it("parses GET response $ref", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path === "/api/acme/v3/widgets")!
        .operations.find((o) => o.method === "get")!,
      resp = get.responses.find((r) => r.statusCode === "200")!;
    expect(resp.schema?.kind).toBe("ref");
    expect(resp.schema?.ref).toBe("ItemListResponse");
  });

  it("parses POST requestBody with oneOf", () => {
    const result = parseSpec(spec, {}),
      post = result.paths
        .find((p) => p.path === "/api/acme/v3/widgets")!
        .operations.find((o) => o.method === "post")!;
    expect(post.requestBody).toBeDefined();
    expect(post.requestBody!.required).toBe(true);
    expect(post.requestBody!.schema.kind).toBe("oneOf");
    expect(post.requestBody!.schema.oneOf).toHaveLength(2);
    expect(post.requestBody!.schema.oneOf![0]!.kind).toBe("ref");
    expect(post.requestBody!.schema.oneOf![1]!.kind).toBe("ref");
  });

  it("inherits path-level params in GET {slug}", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("{slug}"))!
        .operations.find((o) => o.method === "get")!;
    expect(get.pathParams).toHaveLength(1);
    expect(get.pathParams[0]!.name).toBe("slug");
    expect(get.pathParams[0]!.schema.kind).toBe("string");
    expect(get.pathParams[0]!.schema.format).toBe("uuid");
  });

  it("parses DELETE operation", () => {
    const result = parseSpec(spec, {}),
      del = result.paths
        .find((p) => p.path.includes("{slug}"))!
        .operations.find((o) => o.method === "delete")!;
    expect(del.operationId).toBe("deleteItem");
    expect(del.responses[0]!.statusCode).toBe("204");
  });

  it("parses 404 response without schema", () => {
    const result = parseSpec(spec, {}),
      get = result.paths
        .find((p) => p.path.includes("{slug}"))!
        .operations.find((o) => o.method === "get")!,
      notFound = get.responses.find((r) => r.statusCode === "404");
    expect(notFound).toBeDefined();
    expect(notFound?.schema).toBeUndefined();
  });

  it("parses components.schemas", () => {
    const result = parseSpec(spec, {});
    expect(Object.keys(result.components.schemas)).toHaveLength(5);
    expect(result.components.schemas).toHaveProperty("Item");
    expect(result.components.schemas).toHaveProperty("ItemListResponse");
  });

  it("parses Item schema with required array", () => {
    const result = parseSpec(spec, {}),
      item = result.components.schemas["Item"]!;
    expect(item.kind).toBe("object");
    expect(item.required).toEqual(["id", "name"]);
    expect(item.properties?.["id"]?.required).toBe(true);
    expect(item.properties?.["count"]?.required).toBe(false);
  });

  it("parses array schema with $ref items", () => {
    const result = parseSpec(spec, {}),
      listResp = result.components.schemas["ItemListResponse"]!,
      dataProp = listResp.properties?.["data"];
    expect(dataProp?.schema.kind).toBe("array");
    expect(dataProp?.schema.items?.kind).toBe("ref");
    expect(dataProp?.schema.items?.ref).toBe("Item");
  });

  it("parses array schema with scalar items", () => {
    const result = parseSpec(spec, {}),
      item = result.components.schemas["Item"]!,
      tagsProp = item.properties?.["tags"];
    expect(tagsProp?.schema.kind).toBe("array");
    expect(tagsProp?.schema.items?.kind).toBe("string");
  });

  it("parses enum values on string property", () => {
    const result = parseSpec(spec, {}),
      bodyA = result.components.schemas["CreateItemBodyA"]!,
      kindProp = bodyA.properties?.["kind"];
    expect(kindProp?.schema.kind).toBe("string");
    expect(kindProp?.schema.enum).toEqual(["A"]);
  });

  it("parses nullable string property", () => {
    const result = parseSpec(spec, {}),
      nullableSchema = result.components.schemas["NullableField"]!;
    expect(nullableSchema.properties?.["value"]?.schema.nullable).toBe(true);
  });

  it("parses integer type as kind:number", () => {
    const result = parseSpec(spec, {}),
      item = result.components.schemas["Item"]!;
    expect(item.properties?.["count"]?.schema.kind).toBe("number");
  });

  it("filters paths by pathPrefix", () => {
    const result = parseSpec(spec, { pathPrefix: "/api/acme/v3/widgets/" });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]!.path).toContain("{slug}");
  });

  it("ignorePaths excludes the specified path", () => {
    const result = parseSpec(spec, { ignorePaths: ["/api/acme/v3/widgets"] });
    expect(result.paths.every((p) => p.path !== "/api/acme/v3/widgets")).toBe(
      true
    );
  });

  it("handles spec version 3.1.0", () => {
    const spec31 = { ...spec, openapi: "3.1.0" },
      result = parseSpec(spec31, {});
    expect(result.paths).toHaveLength(2);
  });
});
