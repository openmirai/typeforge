import { describe, expect, it } from "vitest";
import { parseSchema, parseSpec } from "../index";

describe("$ref handling and circular ref guard", () => {
  it("$ref in schema property is kind:ref with extracted name", () => {
    const schema = parseSchema({
      properties: { child: { $ref: "#/components/schemas/Child" } },
      type: "object",
    });
    expect(schema.properties?.["child"]?.schema.kind).toBe("ref");
    expect(schema.properties?.["child"]?.schema.ref).toBe("Child");
  });

  it("$ref at top level is kind:ref", () => {
    const schema = parseSchema({ $ref: "#/definitions/Foo" });
    expect(schema.kind).toBe("ref");
    expect(schema.ref).toBe("Foo");
  });

  it("self-referential schema does not infinite-recurse (circular guard)", () => {
    const spec = {
      components: {
        schemas: {
          Node: {
            properties: {
              children: {
                items: { $ref: "#/components/schemas/Node" },
                type: "array",
              },
            },
            type: "object",
          },
        },
      },
      openapi: "3.0.0",
      paths: {},
    };
    // Should not throw
    expect(() => parseSpec(spec, {})).not.toThrow();
    const result = parseSpec(spec, {}),
      node = result.components.schemas["Node"]!;
    expect(node.kind).toBe("object");
    const childrenProp = node.properties?.["children"];
    expect(childrenProp?.schema.kind).toBe("array");
    // Items is a $ref → kind:ref, no further recursion
    expect(childrenProp?.schema.items?.kind).toBe("ref");
    expect(childrenProp?.schema.items?.ref).toBe("Node");
  });

  it("mutual circular refs via allOf do not infinite-recurse", () => {
    const spec = {
      components: {
        schemas: {
          A: {
            allOf: [
              { $ref: "#/components/schemas/B" },
              { type: "object", properties: { aField: { type: "string" } } },
            ],
          },
          B: {
            allOf: [
              { $ref: "#/components/schemas/A" },
              { type: "object", properties: { bField: { type: "string" } } },
            ],
          },
        },
      },
      openapi: "3.0.0",
      paths: {},
    };
    expect(() => parseSpec(spec, {})).not.toThrow();
    const result = parseSpec(spec, {}),
      schemaA = result.components.schemas["A"]!;
    expect(schemaA.kind).toBe("allOf");
    // First allOf entry is a $ref to B → kind:ref (no recursion)
    expect(schemaA.allOf?.[0]?.kind).toBe("ref");
    expect(schemaA.allOf?.[0]?.ref).toBe("B");
  });

  it("nested multi-level refs are each preserved as kind:ref", () => {
    const spec = {
        components: {
          schemas: {
            DataB: {
              properties: {
                value: { $ref: "#/components/schemas/ValueC" },
              },
              type: "object",
            },
            ResponseA: {
              properties: {
                data: { $ref: "#/components/schemas/DataB" },
              },
              type: "object",
            },
            ValueC: { type: "string" },
          },
        },
        openapi: "3.0.0",
        paths: {
          "/foo": {
            get: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/ResponseA" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      result = parseSpec(spec, {}),
      respA = result.components.schemas["ResponseA"]!;
    expect(respA.kind).toBe("object");
    expect(respA.properties?.["data"]?.schema.kind).toBe("ref");
    expect(respA.properties?.["data"]?.schema.ref).toBe("DataB");

    const dataB = result.components.schemas["DataB"]!;
    expect(dataB.properties?.["value"]?.schema.kind).toBe("ref");
    expect(dataB.properties?.["value"]?.schema.ref).toBe("ValueC");

    const valueC = result.components.schemas["ValueC"]!;
    expect(valueC.kind).toBe("string");
  });

  it("ref in OA3 response body is kind:ref", () => {
    const spec = {
        components: {
          schemas: {
            Item: { properties: { id: { type: "integer" } }, type: "object" },
            ItemList: {
              items: { $ref: "#/components/schemas/Item" },
              type: "array",
            },
          },
        },
        openapi: "3.0.0",
        paths: {
          "/items": {
            get: {
              responses: {
                "200": {
                  content: {
                    "application/json": {
                      schema: { $ref: "#/components/schemas/ItemList" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      result = parseSpec(spec, {}),
      op = result.paths[0]!.operations[0]!;
    expect(op.responses[0]!.schema?.kind).toBe("ref");
    expect(op.responses[0]!.schema?.ref).toBe("ItemList");

    // The ItemList schema itself has items as kind:ref
    const itemList = result.components.schemas["ItemList"]!;
    expect(itemList.kind).toBe("array");
    expect(itemList.items?.kind).toBe("ref");
    expect(itemList.items?.ref).toBe("Item");
  });

  it("ref in Swagger 2 response schema is kind:ref", () => {
    const spec = {
        definitions: {
          Item: { properties: { id: { type: "integer" } }, type: "object" },
          ItemList: {
            items: { $ref: "#/definitions/Item" },
            type: "array",
          },
        },
        paths: {
          "/items": {
            get: {
              responses: {
                "200": { schema: { $ref: "#/definitions/ItemList" } },
              },
            },
          },
        },
        swagger: "2.0",
      },
      result = parseSpec(spec, {}),
      op = result.paths[0]!.operations[0]!;
    expect(op.responses[0]!.schema?.kind).toBe("ref");
    expect(op.responses[0]!.schema?.ref).toBe("ItemList");
  });

  it("ref in OA3 request body is kind:ref", () => {
    const spec = {
        components: {
          schemas: {
            CreateBody: {
              properties: { name: { type: "string" } },
              type: "object",
            },
          },
        },
        openapi: "3.0.0",
        paths: {
          "/items": {
            post: {
              requestBody: {
                content: {
                  "application/json": {
                    schema: { $ref: "#/components/schemas/CreateBody" },
                  },
                },
                required: true,
              },
              responses: { "201": {} },
            },
          },
        },
      },
      result = parseSpec(spec, {}),
      op = result.paths[0]!.operations[0]!;
    expect(op.requestBody?.schema.kind).toBe("ref");
    expect(op.requestBody?.schema.ref).toBe("CreateBody");
  });

  it("ref in Swagger 2 body param is kind:ref", () => {
    const spec = {
        definitions: {
          CreateBody: {
            properties: { name: { type: "string" } },
            type: "object",
          },
        },
        paths: {
          "/items": {
            post: {
              parameters: [
                {
                  name: "body",
                  in: "body",
                  required: true,
                  schema: { $ref: "#/definitions/CreateBody" },
                },
              ],
              responses: { "201": {} },
            },
          },
        },
        swagger: "2.0",
      },
      result = parseSpec(spec, {}),
      op = result.paths[0]!.operations[0]!;
    expect(op.requestBody?.schema.kind).toBe("ref");
    expect(op.requestBody?.schema.ref).toBe("CreateBody");
  });

  it("anyOf is preserved in IR", () => {
    const schema = parseSchema({
      anyOf: [{ type: "string" }, { type: "number" }],
    });
    expect(schema.kind).toBe("anyOf");
    expect(schema.anyOf).toHaveLength(2);
    expect(schema.anyOf![0]!.kind).toBe("string");
  });

  it("allOf is preserved in IR", () => {
    const schema = parseSchema({
      allOf: [
        { $ref: "#/components/schemas/Base" },
        { properties: { extra: { type: "boolean" } }, type: "object" },
      ],
    });
    expect(schema.kind).toBe("allOf");
    expect(schema.allOf![0]!.kind).toBe("ref");
    expect(schema.allOf![1]!.kind).toBe("object");
  });
});
