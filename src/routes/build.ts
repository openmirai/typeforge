import { appendSearchParams } from "./search-params";
import type { SearchParamValue } from "./search-params";
import type { BuildRouteFn, RouteHandlers, RouteKeyFromParams } from "./types";

interface RouteParamsShape {
  [routeKey: string]: undefined | object;
}

export type { RouteParamsShape };

/** Mirrors FE getDynamicRoute, with RouteParams typing and encodeURIComponent. */
export function createRouteHandlers<T extends RouteParamsShape>(
  targets: Record<RouteKeyFromParams<T>, string>
): RouteHandlers<T> {
  return Object.fromEntries(
    Object.entries(targets).map(([key, value]) => {
      if (!/:[^/]+/.test(value)) {
        return [key, value];
      }

      return [
        key,
        (
          params: Extract<T[typeof key], object>,
          searchParams?: Record<string, SearchParamValue>
        ) => {
          let result = value;
          for (const [paramKey, paramValue] of Object.entries(params)) {
            result = result.replaceAll(
              `:${paramKey}`,
              encodeURIComponent(String(paramValue))
            );
          }
          return appendSearchParams(result, searchParams);
        },
      ];
    })
  ) as RouteHandlers<T>;
}

export function buildRouteFromHandlers<T extends RouteParamsShape>(
  routes: RouteHandlers<T>
): BuildRouteFn<T> {
  const buildRoute = (<K extends RouteKeyFromParams<T>>(
    key: K,
    ...params: T[K] extends undefined ? [] : [Extract<T[K], object>]
  ): string => {
    const route = routes[key];
    if (typeof route === "function") {
      return route(params[0] as Extract<T[K], object>);
    }
    return route;
  }) as BuildRouteFn<T>;

  return buildRoute;
}

/** @deprecated Use createRouteHandlers + buildRouteFromHandlers instead. */
export function buildRouteFromRegistry<T extends RouteParamsShape>(
  routes: RouteHandlers<T>
): BuildRouteFn<T> {
  return buildRouteFromHandlers(routes);
}
