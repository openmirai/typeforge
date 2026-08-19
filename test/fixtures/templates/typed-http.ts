export interface HTTPFetchConfig<
  TParams extends Record<
    string,
    string | number | boolean | null | undefined
  > = Record<string, string | number | boolean | null | undefined>,
> {
  signal?: AbortSignal;
  params?: TParams;
  headers?: Record<string, string>;
}

export interface HTTPFetch {
  get<
    TResponse,
    TParams extends Record<
      string,
      string | number | boolean | null | undefined
    > = Record<string, string | number | boolean | null | undefined>,
  >(
    route: string,
    config?: HTTPFetchConfig<TParams>
  ): Promise<{ data: TResponse }>;
  post<
    TResponse,
    TBody = unknown,
    TParams extends Record<
      string,
      string | number | boolean | null | undefined
    > = Record<string, string | number | boolean | null | undefined>,
  >(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams>
  ): Promise<{ data: TResponse }>;
  put<
    TResponse,
    TBody = unknown,
    TParams extends Record<
      string,
      string | number | boolean | null | undefined
    > = Record<string, string | number | boolean | null | undefined>,
  >(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams>
  ): Promise<{ data: TResponse }>;
  patch<
    TResponse,
    TBody = unknown,
    TParams extends Record<
      string,
      string | number | boolean | null | undefined
    > = Record<string, string | number | boolean | null | undefined>,
  >(
    route: string,
    body: TBody,
    config?: HTTPFetchConfig<TParams>
  ): Promise<{ data: TResponse }>;
  delete<
    TResponse,
    TParams extends Record<
      string,
      string | number | boolean | null | undefined
    > = Record<string, string | number | boolean | null | undefined>,
  >(
    route: string,
    config?: HTTPFetchConfig<TParams>
  ): Promise<{ data: TResponse }>;
}

export const httpFetch: HTTPFetch = {
  delete: async <TResponse>() => ({ data: undefined as TResponse }),
  get: async <TResponse>() => ({ data: undefined as TResponse }),
  patch: async <TResponse, TBody = unknown>() => ({ data: undefined as TResponse }),
  post: async <TResponse, TBody = unknown>() => ({ data: undefined as TResponse }),
  put: async <TResponse, TBody = unknown>() => ({ data: undefined as TResponse }),
};
