import { apiConfig } from "@/shared/config";
import { ApiError, readError } from "./errors";
import { logError, logRequest } from "./log";
import { getAccessToken, notifyUnauthorized } from "./token";

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiRequestOptions {
  method?: Method;
  body?: unknown;
  form?: FormData;
  search?: URLSearchParams | Record<string, string>;
  timeoutMs?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface PreparedRequest {
  url: string;
  method: Method;
  init: RequestInit;
  startedAt: number;
  hasAuth: boolean;
  timedOut: () => boolean;
  cleanup: () => void;
}

/** Держит открытый поток и управляет его таймером/отменой. */
export interface ApiStream {
  response: Response;
  timedOut: () => boolean;
  close: () => void;
}

function prepareRequest(path: string, options: ApiRequestOptions): PreparedRequest {
  const { method = "GET", body, form, search, timeoutMs, headers, signal } = options;

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
  const onAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onAbort, { once: true });
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

  return {
    url: url.toString(),
    method,
    init,
    startedAt: Date.now(),
    hasAuth: Boolean(token),
    timedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

function toTransportError(cause: unknown, method: Method, path: string, timedOut: boolean): Error {
  if (cause instanceof ApiError) return cause;
  if (cause instanceof DOMException && cause.name === "AbortError") {
    if (!timedOut) return cause;
    logError(`timeout ${method} ${path}`, cause);
    return new ApiError(0, null, "timeout");
  }
  logError(`network ${method} ${path}`, cause);
  return new ApiError(0, null, "network");
}

export async function apiRequest(path: string, options: ApiRequestOptions = {}): Promise<unknown> {
  const prepared = prepareRequest(path, options);

  try {
    const res = await fetch(prepared.url, prepared.init);
    logRequest({
      method: prepared.method,
      path,
      status: res.status,
      durationMs: Date.now() - prepared.startedAt,
    });
    if (res.status === 401) {
      if (prepared.hasAuth) notifyUnauthorized();
      throw await readError(res);
    }
    if (!res.ok) throw await readError(res);
    return await res.json();
  } catch (cause) {
    throw toTransportError(cause, prepared.method, path, prepared.timedOut());
  } finally {
    prepared.cleanup();
  }
}

/** Открывает потоковый ответ backend; вызывающий обязан вызвать `close`. */
export async function apiStream(path: string, options: ApiRequestOptions = {}): Promise<ApiStream> {
  const prepared = prepareRequest(path, {
    ...options,
    headers: { Accept: "text/event-stream", ...(options.headers ?? {}) },
  });

  try {
    const res = await fetch(prepared.url, prepared.init);
    logRequest({
      method: prepared.method,
      path,
      status: res.status,
      durationMs: Date.now() - prepared.startedAt,
    });
    if (res.status === 401) {
      if (prepared.hasAuth) notifyUnauthorized();
      throw await readError(res);
    }
    if (!res.ok) throw await readError(res);
    return {
      response: res,
      timedOut: prepared.timedOut,
      close: prepared.cleanup,
    };
  } catch (cause) {
    prepared.cleanup();
    throw toTransportError(cause, prepared.method, path, prepared.timedOut());
  }
}

export function parseData<T>(data: unknown, guard: (value: unknown) => value is T): T {
  if (!guard(data)) throw new ApiError(0, "Некорректный ответ сервера");
  return data;
}
