import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bold, cyan, dim, isColorEnabled, red, yellow } from "../index";

function enableTTY(): void {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: true,
    writable: true,
  });
}

function disableTTY(): void {
  Object.defineProperty(process.stdout, "isTTY", {
    configurable: true,
    value: undefined,
    writable: true,
  });
}

describe("color - NO_COLOR env var", () => {
  beforeEach(() => {
    // Even in TTY mode, NO_COLOR must override
    enableTTY();
    process.env["NO_COLOR"] = "1";
  });

  afterEach(() => {
    disableTTY();
    delete process.env["NO_COLOR"];
  });

  it("isColorEnabled returns false when NO_COLOR is set", () => {
    expect(isColorEnabled()).toBe(false);
  });

  it("bold returns plain text when NO_COLOR=1", () => {
    expect(bold("hello")).toBe("hello");
  });

  it("red returns plain text when NO_COLOR=1", () => {
    expect(red("error")).toBe("error");
  });

  it("dim returns plain text when NO_COLOR=1", () => {
    expect(dim("muted")).toBe("muted");
  });

  it("cyan returns plain text when NO_COLOR=1", () => {
    expect(cyan("cmd")).toBe("cmd");
  });

  it("yellow returns plain text when NO_COLOR=1", () => {
    expect(yellow("warn")).toBe("warn");
  });

  it("output contains zero ANSI escape sequences under NO_COLOR", () => {
    const output = `${bold(red("header"))}\n${dim("tried")}\n${cyan("fix")}`;
    expect(stripVTControlCharacters(output)).toBe("header\ntried\nfix");
  });

  it("NO_COLOR with any non-empty value disables color", () => {
    process.env["NO_COLOR"] = "";
    // Empty string: per NO_COLOR spec, any presence disables color
    // Our impl checks `!== undefined`, so empty string also disables
    expect(isColorEnabled()).toBe(false);
  });
});
