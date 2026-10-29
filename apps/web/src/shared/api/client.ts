import { apiConfig } from "@/shared/config";
import { ApiError, readError } from "./errors";
import { logError, logRequest } from "./log";
import { getAccessToken, notifyUnauthorized } from "./token";

type Method = "GET" | "POST" | "DELETE";
type ParseMode = "json" | "blob" | "text" | "none";

export interface ApiRequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  search?: URLSearchParams | Record<string, string>;
  timeoutMs?: number;
  headers?: Record<string, string>;
  parse?: ParseMode;
  signal?: AbortSignal;
}

export async function apiRequest(
  path: string,
  options: ApiRequestOptions = {},
): Promise<unknown> {
  const {
    method = "GET",
    body,
    form,
    search,
    timeoutMs,
    headers,
    parse = "json",
    signal,
  } = options;

  const url = new URL(`${apiConfig.baseUrl}${path}`);
  if (search instanceof URLSearchParams) {
    url.search = search.toString();
  } else if (search) {
    for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs ?? apiConfig.timeoutsMs.default);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  const requestHeaders: Record<string, string> = { ...(headers ?? {}) };
  const token = getAccessToken();
  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  const init: RequestInit = { method, headers: requestHeaders, signal: controller.signal };
  if (form) {
    init.body = form;
  } else if (body instanceof URLSearchParams) {
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = body.toString();
  } else if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const startedAt = Date.now();
  try {
    const res = await fetch(url.toString(), init);
    logRequest({ method, path, status: res.status, durationMs: Date.now() - startedAt });
    if (res.status === 401) {
      if (token) notifyUnauthorized();
      throw await readError(res);
    }
    if (!res.ok) throw await readError(res);
    if (parse === "blob") return await res.blob();
    if (parse === "text") return await res.text();
    if (parse === "none") return null;
    return await res.json();
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (cause instanceof DOMException && cause.name === "AbortError") {
      if (!timedOut) throw cause;
      logError(`timeout ${method} ${path}`, cause);
      throw new ApiError(0, null, "timeout");
    }
    logError(`network ${method} ${path}`, cause);
    throw new ApiError(0, null, "network");
  } finally {
    clearTimeout(timer);
  }
}

export async function apiBlob(
  path: string,
  options: ApiRequestOptions = {},
): Promise<Blob> {
  const data: unknown = await apiRequest(path, { ...options, parse: "blob" });
  if (data instanceof Blob) return data;
  throw new ApiError(0, "Некорректный ответ сервера");
}

export function parseData<T>(
  data: unknown,
  guard: (value: unknown) => value is T,
): T {
  if (!guard(data)) throw new ApiError(0, "Некорректный ответ сервера");
  return data;
}
