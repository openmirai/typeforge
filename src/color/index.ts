import chalk from "chalk";

export function isColorEnabled(): boolean {
  if (process.env["NO_COLOR"] !== undefined) {
    return false;
  }
  return process.stdout.isTTY === true;
}

function paint(formatter: (text: string) => string, text: string): string {
  return isColorEnabled() ? formatter(text) : text;
}

export function bold(text: string): string {
  return paint(chalk.bold, text);
}

export function red(text: string): string {
  return paint(chalk.red, text);
}

export function dim(text: string): string {
  return paint(chalk.dim, text);
}

export function cyan(text: string): string {
  return paint(chalk.cyan, text);
}

export function yellow(text: string): string {
  return paint(chalk.yellow, text);
}

export function white(text: string): string {
  return paint(chalk.white, text);
}
