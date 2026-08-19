import type { AxiosInstance, AxiosRequestConfig } from "axios";

import { coerceResponseData } from "../../http/validate";
import type { HTTPFetch, HTTPFetchConfig } from "../../http/types";
import type { QueryParams } from "../../json/types";

function toAxiosConfig<TParams extends QueryParams>(
  config?: HTTPFetchConfig<TParams, unknown>
): AxiosRequestConfig | undefined {
  if (config === undefined) {
    return undefined;
  }

  const axiosConfig: AxiosRequestConfig = {};
  if (config.signal !== undefined) {
    axiosConfig.signal = config.signal;
  }
  if (config.params !== undefined) {
    axiosConfig.params = config.params;
  }
  if (config.headers !== undefined) {
    axiosConfig.headers = config.headers;
  }
  return axiosConfig;
}

function mapResponse<TResponse>(
  data: unknown,
  config?: HTTPFetchConfig<QueryParams, TResponse>
): { data: TResponse } {
  return {
    data: coerceResponseData<TResponse>(data, config?.validateResponse),
  };
}

export function createAxiosAdapter(instance: AxiosInstance): HTTPFetch {
  return {
    delete: <TResponse, TParams extends QueryParams = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      instance
        .delete<TResponse>(route, toAxiosConfig(config))
        .then((response) => mapResponse(response.data, config)),
    get: <TResponse, TParams extends QueryParams = QueryParams>(
      route: string,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      instance
        .get<TResponse>(route, toAxiosConfig(config))
        .then((response) => mapResponse(response.data, config)),
    patch: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      instance
        .patch<TResponse>(route, body, toAxiosConfig(config))
        .then((response) => mapResponse(response.data, config)),
    post: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      instance
        .post<TResponse>(route, body, toAxiosConfig(config))
        .then((response) => mapResponse(response.data, config)),
    put: <
      TResponse,
      TBody = unknown,
      TParams extends QueryParams = QueryParams,
    >(
      route: string,
      body: TBody,
      config?: HTTPFetchConfig<TParams, TResponse>
    ) =>
      instance
        .put<TResponse>(route, body, toAxiosConfig(config))
        .then((response) => mapResponse(response.data, config)),
  };
}

export type { HTTPFetch, HTTPFetchConfig } from "../../http/types";
