import type { QueryParams } from "../json/types";
import type { ResponseValidator } from "./validate";

export type { QueryParamValue, QueryParams } from "../json/types";
export type { ResponseValidator } from "./validate";
export { coerceResponseData, ResponseValidationError } from "./validate";

export interface HTTPFetchConfig<
  TParams extends QueryParams = QueryParams,
  TResponse = unknown,
> {
  signal?: AbortSignal;
  params?: TParams;
  headers?: Record<string, string>;
  validateResponse?: ResponseValidator<TResponse>;
}

export interface HTTPFetch {
  get<TResponse, TParams extends QueryParams = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  post<TResponse, TBody = unknown, TParams extends QueryParams = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  put<TResponse, TBody = unknown, TParams extends QueryParams = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  patch<TResponse, TBody = unknown, TParams extends QueryParams = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  delete<TResponse, TParams extends QueryParams = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
}
