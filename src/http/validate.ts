export type ResponseValidator<T> = (value: unknown) => T;

export class ResponseValidationError extends Error {
  override readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "ResponseValidationError";
    this.cause = cause;
  }
}

export function coerceResponseData<T>(
  value: unknown,
  validator?: ResponseValidator<T>
): T {
  if (validator === undefined) {
    return value as T;
  }

  try {
    return validator(value);
  } catch (error) {
    throw new ResponseValidationError("Response validation failed", error);
  }
}
