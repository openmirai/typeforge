import { describe, expect, it, vi } from "vitest";

import { ResponseValidationError } from "../../../http/validate";
import { createFetchAdapter } from "../index";

describe("createFetchAdapter", () => {
  it("GET preserves typed response generic", async () => {
    interface ItemsResponse {
      items: Array<string>;
    }

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ items: ["a"] }),
    });

    const adapter = createFetchAdapter({
      fetch: fetchMock as typeof fetch,
    });

    const result = await adapter.get<ItemsResponse>("/items", {
      params: { page: 2 },
    });
    expect(result.data.items).toEqual(["a"]);
  });

  it("GET serializes params and prepends baseURL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ items: [] }),
    });

    const adapter = createFetchAdapter({
      baseURL: "https://api.example.com",
      fetch: fetchMock as typeof fetch,
    });

    await adapter.get("/items", { params: { page: 2, q: "a" } });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.com/items?page=2&q=a",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("POST sends JSON body with content type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ id: "1" }),
    });

    const adapter = createFetchAdapter({ fetch: fetchMock as typeof fetch });
    await adapter.post<{ id: string }, { name: string }>("/items", {
      name: "widget",
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init).toMatchObject({
      body: JSON.stringify({ name: "widget" }),
      headers: expect.objectContaining({
        "Content-Type": "application/json",
      }),
      method: "POST",
    });
  });

  it("rejects on non-OK responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "fail",
    });

    const adapter = createFetchAdapter({ fetch: fetchMock as typeof fetch });
    await expect(adapter.get("/broken")).rejects.toThrow("HTTP 500");
  });

  it("PUT and PATCH send JSON bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ ok: true }),
    });

    const adapter = createFetchAdapter({ fetch: fetchMock as typeof fetch });
    await adapter.put<{ ok: boolean }, { name: string }>("/items/1", {
      name: "updated",
    });
    await adapter.patch<{ ok: boolean }, { name: string }>("/items/1", {
      name: "patched",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PUT" });
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "PATCH" });
  });

  it("DELETE supports query params, signal, and empty bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      text: async () => "",
    });

    const controller = new AbortController();
    const adapter = createFetchAdapter({
      fetch: fetchMock as typeof fetch,
      headers: { "X-Org": "org-1" },
    });

    const result = await adapter.delete<{ ok: boolean }>(
      "/items/1?existing=1",
      {
        headers: { Authorization: "Bearer token" },
        params: { force: true },
        signal: controller.signal,
      }
    );

    expect(result.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/items/1?existing=1&force=true",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token",
          "X-Org": "org-1",
        }),
        method: "DELETE",
        signal: controller.signal,
      })
    );
  });

  it("validates JSON responses when validateResponse is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ id: "1" }),
    });

    const adapter = createFetchAdapter({ fetch: fetchMock as typeof fetch });
    const result = await adapter.get<{ id: string }>("/items/1", {
      validateResponse: (value): { id: string } => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("id" in value) ||
          typeof value.id !== "string"
        ) {
          throw new Error("invalid");
        }
        return { id: value.id };
      },
    });

    expect(result.data.id).toBe("1");
  });

  it("throws ResponseValidationError when validation fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ id: 1 }),
    });

    const adapter = createFetchAdapter({ fetch: fetchMock as typeof fetch });
    await expect(
      adapter.get<{ id: string }>("/items/1", {
        validateResponse: (value): { id: string } => {
          if (
            typeof value !== "object" ||
            value === null ||
            !("id" in value) ||
            typeof value.id !== "string"
          ) {
            throw new Error("invalid");
          }
          return { id: value.id };
        },
      })
    ).rejects.toThrow(ResponseValidationError);
  });
});
