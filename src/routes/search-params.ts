export type SearchParamValue = string | number | boolean;

export function appendSearchParams(
  baseUrl: string,
  params?: Record<string, SearchParamValue | null | undefined>
): string {
  if (params === undefined || Object.keys(params).length === 0) {
    return baseUrl;
  }

  const [path, existingQuery] = baseUrl.split("?");
  const searchParams = new URLSearchParams(existingQuery ?? "");

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const queryString = searchParams.toString();
  return queryString.length > 0 ? `${path}?${queryString}` : (path ?? baseUrl);
}
