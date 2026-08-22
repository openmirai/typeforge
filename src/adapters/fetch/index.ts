import type { JsonValue, QueryParams } from "../../json/types";
import { parseJson } from "../../json/types";
import { coerceResponseData } from "../../http/validate";
import type { HTTPFetch, HTTPFetchConfig } from "../../http/types";

/** Options for the Fetch-based `HTTPFetch` adapter. */
export interface FetchAdapterOptions {
  /** Base URL prepended to every generated route. */
  baseURL?: string;
  /** Headers included with every request unless overridden per request. */
  headers?: Record<string, string>;
  /** Fetch implementation to use, such as a test double or platform polyfill. */
  fetch?: typeof fetch;
}

function appendQuery(url: string, params?: object): string {
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

async function request<TResponse, TParams extends object>(
  method: string,
  route: string,
  options: FetchAdapterOptions,
  body?: unknown,
  config?: HTTPFetchConfig<TParams, TResponse>
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

/** Create an `HTTPFetch` implementation backed by the Fetch API. */
export function createFetchAdapter(
  options: FetchAdapterOptions = {}
): HTTPFetch {
  return {
    delete: <TResponse, TParams extends object = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      request<TResponse, TParams>("DELETE", route, options, undefined, config),
    get: <TResponse, TParams extends object = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse, TParams>("GET", route, options, undefined, config),
    patch: <TResponse, TBody = unknown, TParams extends object = QueryParams>(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse, TParams>("PATCH", route, options, body, config),
    post: <TResponse, TBody = unknown, TParams extends object = QueryParams>(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse, TParams>("POST", route, options, body, config),
    put: <TResponse, TBody = unknown, TParams extends object = QueryParams>(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) => request<TResponse, TParams>("PUT", route, options, body, config),
  };
}

export type { HTTPFetch, HTTPFetchConfig } from "../../http/types";
