import { describe, expect, it } from "vitest";

import {
  isJsonArray,
  isJsonObject,
  isJsonValue,
  parseJson,
  readJsonObject,
  readJsonPrimitives,
} from "../types";

describe("json types", () => {
  it("parses valid JSON values", () => {
    expect(parseJson('{"a":1}')).toEqual({ a: 1 });
    expect(parseJson("[1,2]")).toEqual([1, 2]);
    expect(parseJson("null")).toBeNull();
  });

  it("rejects invalid JSON", () => {
    expect(() => parseJson("{")).toThrow(SyntaxError);
  });

  it("narrows json value shapes", () => {
    const value: unknown = { ok: true };
    expect(isJsonValue(value)).toBe(true);
    expect(isJsonObject(value)).toBe(true);
    expect(isJsonArray(value)).toBe(false);
  });

  it("rejects non-json values and non-object roots", () => {
    expect(isJsonValue(undefined)).toBe(false);
    expect(() => parseJson("undefined")).toThrow(SyntaxError);
    expect(() => readJsonObject("[1,2]")).toThrow(TypeError);
    expect(readJsonPrimitives(undefined)).toEqual([]);
  });
});
