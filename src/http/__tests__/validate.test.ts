import { describe, expect, it } from "vitest";

import { coerceResponseData, ResponseValidationError } from "../validate";

describe("coerceResponseData", () => {
  it("returns value as-is without a validator", () => {
    expect(coerceResponseData({ ok: true })).toEqual({ ok: true });
  });

  it("runs validator when provided", () => {
    const result = coerceResponseData("raw", (value) => {
      if (typeof value !== "string") {
        throw new TypeError("expected string");
      }
      return value.toUpperCase();
    });
    expect(result).toBe("RAW");
  });

  it("wraps validator failures in ResponseValidationError", () => {
    expect(() =>
      coerceResponseData(1, () => {
        throw new Error("bad shape");
      })
    ).toThrow(ResponseValidationError);
  });
});
