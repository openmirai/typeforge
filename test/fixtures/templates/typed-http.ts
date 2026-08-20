export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue>;

export type ResponseValidator<TResponse> = (value: unknown) => TResponse;

export interface HTTPFetchConfig<
  TParams extends object = QueryParams,
  TResponse = unknown,
> {
  signal?: AbortSignal;
  params?: TParams;
  headers?: Record<string, string>;
  validateResponse?: ResponseValidator<TResponse>;
}

export interface HTTPFetch {
  get<TResponse, TParams extends object = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  post<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  put<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  patch<TResponse, TBody = unknown, TParams extends object = QueryParams>(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
  delete<TResponse, TParams extends object = QueryParams>(
    route: string,
    config?: HTTPFetchConfig<TParams, TResponse>
  ): Promise<{ data: TResponse }>;
}

export const httpFetch: HTTPFetch = {
  delete: async <TResponse>() => ({ data: undefined as TResponse }),
  get: async <TResponse>() => ({ data: undefined as TResponse }),
  patch: async <TResponse>() => ({ data: undefined as TResponse }),
  post: async <TResponse>() => ({ data: undefined as TResponse }),
  put: async <TResponse>() => ({ data: undefined as TResponse }),
};
