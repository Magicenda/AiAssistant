import { ApiError, readApiError } from "@/shared/api/http";
import { getApiUrl } from "@/shared/lib/api-url";
import { modelRequestSettings } from "@/entities/model-settings";

export interface QueryOptions {
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
}

export interface QueryResult {
  answer: string;
}

function endpoint(path: string) {
  return `${getApiUrl()}${path}`;
}

async function parseError(response: Response) {
  const error = await readApiError(response);
  if (response.status === 404) {
    return new ApiError(error.message, "not_found", 404);
  }
  return error;
}

export async function createRemoteChat(name: string) {
  const response = await fetch(endpoint("/chat/create_chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name_chat: name }),
  });
  if (!response.ok) throw await parseError(response);
  const data: unknown = await response.json();
  const chatId = (data as Record<string, unknown> | null)?.chat_id;
  if (typeof chatId !== "number") {
    throw new ApiError("Сервер не вернул chat_id.", "bad_response", 502);
  }
  return chatId;
}

export async function deleteRemoteChat(chatId: number) {
  const response = await fetch(endpoint(`/chat/delete_chat/${chatId}`), {
    method: "DELETE",
  });
  if (!response.ok && response.status !== 404) throw await parseError(response);
}

function extractAnswer(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  for (const key of ["answer", "text", "content", "delta", "token"]) {
    if (typeof item[key] === "string") return item[key] as string;
  }
  const message = item.message;
  if (typeof message === "string") return message;
  if (message && typeof message === "object") {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") return content;
  }
  const choices = item.choices;
  if (Array.isArray(choices) && choices.length) {
    const choice = choices[0];
    if (choice && typeof choice === "object") {
      const record = choice as Record<string, unknown>;
      const delta = record.delta;
      if (delta && typeof delta === "object") {
        const content = (delta as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
      const choiceMessage = record.message;
      if (choiceMessage && typeof choiceMessage === "object") {
        const content = (choiceMessage as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
      if (typeof record.text === "string") return record.text;
    }
  }
  return "";
}

function parseSseEvent(raw: string) {
  const data = raw
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart())
    .join("\n")
    .trim();
  if (!data || data === "[DONE]") return "";
  try {
    return extractAnswer(JSON.parse(data));
  } catch {
    return data;
  }
}

async function readSse(response: Response, onDelta?: (text: string) => void) {
  if (!response.body) throw new ApiError("Сервер не вернул поток ответа.", "empty_response", 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.search(/\r?\n\r?\n/);
      while (boundary >= 0) {
        const event = buffer.slice(0, boundary);
        const separator = buffer.slice(boundary).match(/^\r?\n\r?\n/)?.[0] ?? "\n\n";
        buffer = buffer.slice(boundary + separator.length);
        const text = parseSseEvent(event);
        if (text) {
          answer += text;
          onDelta?.(text);
        }
        boundary = buffer.search(/\r?\n\r?\n/);
      }
    }
    const tail = decoder.decode();
    if (tail) buffer += tail;
    const rest = parseSseEvent(buffer);
    if (rest) {
      answer += rest;
      onDelta?.(rest);
    }
  } finally {
    reader.releaseLock();
  }

  if (!answer.trim()) throw new ApiError("Сервер вернул пустой ответ.", "empty_response", 502);
  return answer;
}

async function readPlain(response: Response, onDelta?: (text: string) => void) {
  if (!response.body) throw new ApiError("Сервер не вернул ответ.", "empty_response", 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) {
        answer += text;
        onDelta?.(text);
      }
    }
    const tail = decoder.decode();
    if (tail) {
      answer += tail;
      onDelta?.(tail);
    }
  } finally {
    reader.releaseLock();
  }
  if (!answer.trim()) throw new ApiError("Сервер вернул пустой ответ.", "empty_response", 502);
  return answer;
}

export async function queryAssistant(
  chatId: number,
  query: string,
  options: QueryOptions = {},
): Promise<QueryResult> {
  const settings = modelRequestSettings();
  const response = await fetch(endpoint("/llm/query"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json, text/plain",
    },
    body: JSON.stringify({
      chat_id: chatId,
      query,
      ...(settings ? { model_settings: settings } : {}),
    }),
    signal: options.signal,
  });
  if (!response.ok) throw await parseError(response);

  const type = response.headers.get("content-type") ?? "";
  if (type.includes("text/event-stream")) {
    return { answer: await readSse(response, options.onDelta) };
  }
  if (type.includes("application/json")) {
    const data: unknown = await response.json();
    const answer = extractAnswer(data);
    if (!answer.trim()) throw new ApiError("Сервер вернул пустой ответ.", "empty_response", 502);
    options.onDelta?.(answer);
    return { answer };
  }
  return { answer: await readPlain(response, options.onDelta) };
}

export async function transcribeVoice(chatId: number, file: Blob) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("file", file, file instanceof File ? file.name : "voice.webm");
  const settings = modelRequestSettings();
  if (settings) form.append("model_settings", JSON.stringify(settings));

  const response = await fetch(endpoint("/chat/transcribe"), {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw await parseError(response);

  const data: unknown = await response.json();
  const text = (data as Record<string, unknown> | null)?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new ApiError("Сервер не вернул расшифровку речи.", "empty_response", 502);
  }
  return text.trim();
}
