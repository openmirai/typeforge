import type { JsonValue, QueryParams } from "../../json/types";
import { parseJson } from "../../json/types";
import { coerceResponseData } from "../../http/validate";
import type { HTTPFetch, HTTPFetchConfig } from "../../http/types";

export interface FetchAdapterOptions {
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

function appendQuery(url: string, params?: QueryParams): string {
  if (params === undefined || Object.keys(params).length === 0) {
    return url;
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.append(key, String(value));
  }

  const query = search.toString();
  if (query.length === 0) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${query}`;
}

function readResponseBody(text: string): JsonValue | undefined {
  if (text.length === 0) {
    return undefined;
  }
  return parseJson(text);
}

async function request<TResponse>(
  method: string,
  route: string,
  options: FetchAdapterOptions,
  body?: unknown,
  config?: HTTPFetchConfig<QueryParams, TResponse>
): Promise<{ data: TResponse }> {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const baseURL = options.baseURL ?? "";
  const url = appendQuery(`${baseURL}${route}`, config?.params);

  const headers: Record<string, string> = {
    ...options.headers,
    ...config?.headers,
  };

  const init: RequestInit = {
    headers,
    method,
  };
  if (config?.signal !== undefined) {
    init.signal = config.signal;
  }

  if (body !== undefined) {
    headers["Content-Type"] ??= "application/json";
    init.body = JSON.stringify(body);
  }

  const response = await fetchImpl(url, init);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const parsed = readResponseBody(text);
  return {
    data: coerceResponseData<TResponse>(parsed, config?.validateResponse),
  };
}

export function createFetchAdapter(
  options: FetchAdapterOptions = {}
): HTTPFetch {
  return {
    delete: <TResponse, TParams extends QueryParams = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse>("DELETE", route, options, undefined, config),
    get: <TResponse, TParams extends QueryParams = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse>("GET", route, options, undefined, config),
    patch: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse>("PATCH", route, options, body, config),
    post: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse>("POST", route, options, body, config),
    put: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse>("PUT", route, options, body, config),
  };
}

export type { HTTPFetch, HTTPFetchConfig } from "../../http/types";
