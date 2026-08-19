import { stripVTControlCharacters } from "node:util";
import chalk from "chalk";
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

describe("color - TTY mode (ANSI enabled)", () => {
  beforeEach(() => {
    delete process.env["NO_COLOR"];
    enableTTY();
  });

  afterEach(() => {
    disableTTY();
    delete process.env["NO_COLOR"];
  });

  it("isColorEnabled returns true in TTY without NO_COLOR", () => {
    expect(isColorEnabled()).toBe(true);
  });

  it("bold wraps text using chalk", () => {
    expect(bold("hello")).toBe(chalk.bold("hello"));
  });

  it("red wraps text using chalk", () => {
    expect(red("error")).toBe(chalk.red("error"));
  });

  it("dim wraps text using chalk", () => {
    expect(dim("muted")).toBe(chalk.dim("muted"));
  });

  it("cyan wraps text using chalk", () => {
    expect(cyan("cmd")).toBe(chalk.cyan("cmd"));
  });

  it("yellow wraps text using chalk", () => {
    expect(yellow("warn")).toBe(chalk.yellow("warn"));
  });

  it("plain text content is identical after stripping ANSI codes", () => {
    const text = "some content";
    expect(stripVTControlCharacters(bold(red(text)))).toBe(text);
  });
});

describe("color - non-TTY mode (ANSI disabled)", () => {
  beforeEach(() => {
    delete process.env["NO_COLOR"];
    disableTTY();
  });

  it("isColorEnabled returns false when not a TTY", () => {
    expect(isColorEnabled()).toBe(false);
  });

  it("bold returns plain text in non-TTY mode", () => {
    expect(bold("hello")).toBe("hello");
  });

  it("red returns plain text in non-TTY mode", () => {
    expect(red("error")).toBe("error");
  });

  it("output contains zero ANSI escape sequences", () => {
    const output = bold(red("test")) + dim("muted") + cyan("cmd");
    expect(stripVTControlCharacters(output)).toBe("testmutedcmd");
  });
});
