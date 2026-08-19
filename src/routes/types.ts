/** Map of route keys to path-param objects, or undefined for static routes. */
export interface RouteParamsMap {
  [routeKey: string]: undefined | { [param: string]: string | number };
}

export type RouteKeyFromParams<T> = keyof T & string;

export type RouteParamsFor<T, K extends RouteKeyFromParams<T>> = T[K];

export type RouteSearchParams = Record<string, string | number | boolean>;

export type RouteHandlers<T> = {
  [K in RouteKeyFromParams<T>]: T[K] extends undefined
    ? string
    : (
        params: Extract<T[K], object>,
        searchParams?: RouteSearchParams
      ) => string;
};

export type BuildRouteFn<T> = <K extends RouteKeyFromParams<T>>(
  key: K,
  ...params: T[K] extends undefined ? [] : [Extract<T[K], object>]
) => string;

/** @deprecated Use RouteHandlers instead. */
export type RouteBuilderFn<P> = P extends undefined
  ? () => string
  : (params: P) => string;

/** @deprecated Use RouteHandlers instead. */
export type RouteRegistry<T> = {
  [K in RouteKeyFromParams<T>]: RouteBuilderFn<T[K]>;
};
