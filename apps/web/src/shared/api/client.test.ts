import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBlob, apiRequest, parseData } from "./client";
import { ApiError } from "./errors";
import { clearAccessToken, setAccessToken, setUnauthorizedHandler } from "./token";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function lastCall(mock: ReturnType<typeof vi.fn>) {
  const call = mock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was not called");
  return { url: call[0] as string, init: call[1] as RequestInit };
}

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (cause) {
    if (cause instanceof ApiError) return cause;
    throw cause;
  }
  throw new Error("expected the promise to reject");
}

describe("apiRequest", () => {
  beforeEach(() => {
    clearAccessToken();
    setUnauthorizedHandler(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("injects the Authorization header when a token exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("token-123");

    await apiRequest("/api/x");

    const { init } = lastCall(fetchMock);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer token-123");
  });

  it("omits the Authorization header without a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/x");

    const { init } = lastCall(fetchMock);
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("serializes JSON bodies and sets Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/x", { method: "POST", body: { a: 1 } });

    const { init } = lastCall(fetchMock);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("encodes URLSearchParams bodies as form-urlencoded", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/auth/login", {
      method: "POST",
      body: new URLSearchParams({ username: "alice", password: "secret" }),
    });

    const { init } = lastCall(fetchMock);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(String(init.body)).toBe("username=alice&password=secret");
  });

  it("passes FormData bodies without forcing Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("chat_id", "1");

    await apiRequest("/api/voice/ask", { method: "POST", form });

    const { init } = lastCall(fetchMock);
    expect(init.body).toBe(form);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("adds query parameters from a record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest("/api/chat/add_message/3", {
      method: "POST",
      search: { role: "user", content: "Привет" },
    });

    const { url } = lastCall(fetchMock);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("role")).toBe("user");
    expect(parsed.searchParams.get("content")).toBe("Привет");
  });

  it("throws ApiError for non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: "Чат не найден" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(apiRequest("/api/chat/get_chat/9"));
    expect(error.status).toBe(404);
    expect(error.message).toBe("Чат не найден");
  });

  it("triggers the unauthorized handler on 401 with a token", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("expired");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ detail: "Not authenticated" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(apiRequest("/api/x"));
    expect(error.status).toBe(401);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not trigger the handler on 401 without a token", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ detail: "Invalid credentials" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(
      apiRequest("/api/auth/login", {
        method: "POST",
        body: new URLSearchParams({ username: "a", password: "b" }),
      }),
    );
    expect(error.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("maps network failures to a network ApiError", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    const error = await catchError(apiRequest("/api/x"));
    expect(error.kind).toBe("network");
    expect(error.status).toBe(0);
  });

  it("aborts via AbortController on timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = apiRequest("/api/llm/query", { timeoutMs: 1000 });
    const assertion = expect(promise).rejects.toMatchObject({ kind: "timeout", status: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("returns blobs when parsed as blob", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(new Blob(["audio"], { type: "audio/mpeg" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiBlob("/api/voice/jobs/1/audio");
    expect(result).toBeInstanceOf(Blob);
  });
});

describe("parseData", () => {
  const guard = (value: unknown): value is { a: number } =>
    typeof value === "object" && value !== null && typeof (value as { a?: unknown }).a === "number";

  it("returns validated data", () => {
    expect(parseData({ a: 1 }, guard)).toEqual({ a: 1 });
  });

  it("throws ApiError on invalid data", () => {
    expect(() => parseData({ a: "x" }, guard)).toThrow(ApiError);
  });
});
