import { describe, expect, it, vi } from "vitest";

import { createAxiosAdapter } from "../index";

describe("createAxiosAdapter", () => {
  it("forwards all HTTP methods to the provided Axios instance", async () => {
    const deleteMock = vi.fn().mockResolvedValue({ data: { ok: true } });
    const getMock = vi.fn().mockResolvedValue({ data: { items: [] } });
    const patchMock = vi.fn().mockResolvedValue({ data: { patched: true } });
    const postMock = vi.fn().mockResolvedValue({ data: { id: "1" } });
    const putMock = vi.fn().mockResolvedValue({ data: { id: "1" } });

    const instance = {
      delete: deleteMock,
      get: getMock,
      patch: patchMock,
      post: postMock,
      put: putMock,
    };

    const adapter = createAxiosAdapter(instance as never);

    await adapter.get("/items", {
      params: { page: 1 },
      signal: new AbortController().signal,
    });
    await adapter.post("/items", { name: "x" }, { headers: { "X-Test": "1" } });
    await adapter.put("/items/1", { name: "y" });
    await adapter.patch("/items/1", { active: true });
    await adapter.delete("/items/1", { params: { force: true } });

    expect(getMock).toHaveBeenCalledWith("/items", {
      headers: undefined,
      params: { page: 1 },
      signal: expect.any(AbortSignal),
    });
    expect(postMock).toHaveBeenCalledWith(
      "/items",
      { name: "x" },
      { headers: { "X-Test": "1" }, params: undefined, signal: undefined }
    );
    expect(putMock).toHaveBeenCalled();
    expect(patchMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalledWith("/items/1", {
      headers: undefined,
      params: { force: true },
      signal: undefined,
    });
  });

  it("returns typed response data from axios generics", async () => {
    interface HelloResponse {
      hello: string;
    }

    const adapter = createAxiosAdapter({
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue({ data: { hello: "world" } }),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    } as never);

    const result = await adapter.get<HelloResponse>("/hello");
    expect(result.data.hello).toBe("world");
  });

  it("validates axios response data when validateResponse is provided", async () => {
    const adapter = createAxiosAdapter({
      delete: vi.fn(),
      get: vi.fn().mockResolvedValue({ data: { count: 2 } }),
      patch: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    } as never);

    const result = await adapter.get<{ count: number }>("/stats", {
      validateResponse: (value): { count: number } => {
        if (
          typeof value !== "object" ||
          value === null ||
          !("count" in value) ||
          typeof value.count !== "number"
        ) {
          throw new Error("invalid");
        }
        return { count: value.count };
      },
    });

    expect(result.data.count).toBe(2);
  });
});
