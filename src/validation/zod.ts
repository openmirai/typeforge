import type { ResponseValidator } from "../http/validate";

export interface ZodLikeSchema<T> {
  parse(value: unknown): T;
}

export function createZodValidator<T>(
  schema: ZodLikeSchema<T>
): ResponseValidator<T> {
  return (value: unknown) => schema.parse(value);
}

export type { ResponseValidator } from "../http/validate";
