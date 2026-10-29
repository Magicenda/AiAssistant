import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError as HttpApiError } from "@/shared/api/http";
import { clearAccessToken, setAccessToken } from "@/shared/api";
import {
  createRemoteChat,
  deleteRemoteChat,
  queryAssistant,
  transcribeVoice,
} from "./client";

function json(data: unknown, status = 200): Response {
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

describe("assistant client (API.md contract)", () => {
  beforeEach(() => {
    clearAccessToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("createRemoteChat posts to /api/chat/create_chat and returns chat_id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ chat_id: 7, name_chat: "Работа", messages: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const id = await createRemoteChat("Работа");

    expect(id).toBe(7);
    const { url, init } = lastCall(fetchMock);
    expect(new URL(url).pathname).toBe("/api/chat/create_chat");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ name_chat: "Работа" });
  });

  it("sends the Bearer token on protected calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ chat_id: 1, name_chat: "", messages: [] }));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("tok-123");

    await createRemoteChat("x");

    expect((lastCall(fetchMock).init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-123",
    );
  });

  it("wraps transport failures in the shared http ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ detail: "Чат не найден" }, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createRemoteChat("x")).rejects.toBeInstanceOf(HttpApiError);
  });

  it("deleteRemoteChat calls DELETE and swallows 404", async () => {
    const okFetch = vi.fn().mockResolvedValue(json(true));
    vi.stubGlobal("fetch", okFetch);

    await deleteRemoteChat(9);
    const { url, init } = lastCall(okFetch);
    expect(new URL(url).pathname).toBe("/api/chat/delete_chat/9");
    expect(init.method).toBe("DELETE");

    const notFound = vi.fn().mockResolvedValue(json({ detail: "not found" }, 404));
    vi.stubGlobal("fetch", notFound);
    await expect(deleteRemoteChat(9)).resolves.toBeUndefined();
  });

  it("queryAssistant posts chat_id+query and returns the JSON answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ answer: "Готово" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await queryAssistant(3, "привет");

    expect(result.answer).toBe("Готово");
    const { url, init } = lastCall(fetchMock);
    expect(new URL(url).pathname).toBe("/api/llm/query");
    expect(JSON.parse(String(init.body))).toEqual({ chat_id: 3, query: "привет" });
  });

  it("queryAssistant calls onDelta once with the full answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ answer: "Ответ" }));
    vi.stubGlobal("fetch", fetchMock);
    const onDelta = vi.fn();

    await queryAssistant(1, "q", { onDelta });

    expect(onDelta).toHaveBeenCalledTimes(1);
    expect(onDelta).toHaveBeenCalledWith("Ответ");
  });

  it("queryAssistant throws on an empty answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ answer: "   " }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(queryAssistant(1, "q")).rejects.toBeInstanceOf(HttpApiError);
  });

  it("queryAssistant propagates external abort as AbortError", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = queryAssistant(1, "q", { signal: controller.signal });
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("transcribeVoice posts multipart to /api/audio/transcribe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ text: "  привет  " }));
    vi.stubGlobal("fetch", fetchMock);

    const text = await transcribeVoice(3, new Blob(["x"], { type: "audio/webm" }));

    expect(text).toBe("привет");
    const { url, init } = lastCall(fetchMock);
    expect(new URL(url).pathname).toBe("/api/audio/transcribe");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });
});
