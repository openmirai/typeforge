import type { QueryParams } from "../json/types";
import type { ResponseValidator } from "./validate";

export type { QueryParamValue, QueryParams } from "../json/types";
export type { ResponseValidator } from "./validate";
export { coerceResponseData, ResponseValidationError } from "./validate";

/** Per-request options accepted by every Typeforge HTTP adapter method. */
export interface HTTPFetchConfig<
  TParams extends object = QueryParams,
  TResponse = unknown,
> {
  /** Abort signal forwarded to the underlying HTTP client. */
  signal?: AbortSignal;
  /** Query parameters serialized by the HTTP adapter. */
  params?: TParams;
  /** Request headers merged with adapter-level defaults. */
  headers?: Record<string, string>;
  /** Optional runtime validator applied to the response payload. */
  validateResponse?: ResponseValidator<TResponse>;
}

/** Transport contract consumed by Typeforge-generated API callers. */
export interface HTTPFetch {
  /** Send a GET request and return its typed response payload. */
  get<TResponse, TParams extends object = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  /** Send a POST request with a typed body and return its typed response payload. */
  post<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  /** Send a PUT request with a typed body and return its typed response payload. */
  put<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  /** Send a PATCH request with a typed body and return its typed response payload. */
  patch<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  /** Send a DELETE request and return its typed response payload. */
  delete<TResponse, TParams extends object = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
}
