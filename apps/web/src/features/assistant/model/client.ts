import { ApiError as HttpApiError } from "@/shared/api/http";
import { ApiError as TransportApiError, apiRequest, parseData } from "@/shared/api";
import { apiConfig } from "@/shared/config";
import { isChatDto, isLlmAnswer } from "@/entities/chat";
import { isTranscript } from "@/entities/voice";

export interface QueryOptions {
  /** Отмена запроса (кнопка «Остановить»). */
  signal?: AbortSignal;
  /** Вызывается один раз с полным ответом по контракту `API.md`. */
  onDelta?: (text: string) => void;
}

export interface QueryResult {
  answer: string;
}

/** Переводит ошибку транспорта в `ApiError` из `shared/api/http` (его ждут фичи). */
async function request<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (cause) {
    if (cause instanceof TransportApiError) {
      const code = cause.status === 404 ? "not_found" : cause.kind;
      throw new HttpApiError(cause.message, code, cause.status);
    }
    throw cause;
  }
}

/** Создаёт чат на backend (`POST /api/chat/create_chat`) и возвращает `chat_id`. */
export function createRemoteChat(name: string): Promise<number> {
  return request(async () => {
    const chat = parseData(
      await apiRequest("/api/chat/create_chat", {
        method: "POST",
        body: { name_chat: name },
      }),
      isChatDto,
    );
    return chat.chat_id;
  });
}

/** Удаляет чат на backend; отсутствие чата (`404`) ошибкой не считается. */
export function deleteRemoteChat(chatId: number): Promise<void> {
  return request(async () => {
    try {
      await apiRequest(`/api/chat/delete_chat/${chatId}`, { method: "DELETE" });
    } catch (cause) {
      if (cause instanceof TransportApiError && cause.status === 404) return;
      throw cause;
    }
  });
}

/** Отправляет текстовый запрос (`POST /api/llm/query`) и ждёт JSON-ответ. */
export function queryAssistant(
  chatId: number,
  query: string,
  options: QueryOptions = {},
): Promise<QueryResult> {
  return request(async () => {
    const result = parseData(
      await apiRequest("/api/llm/query", {
        method: "POST",
        body: { chat_id: chatId, query },
        signal: options.signal,
        timeoutMs: apiConfig.timeoutsMs.llmQuery,
      }),
      isLlmAnswer,
    );
    if (!result.answer.trim()) {
      throw new HttpApiError("Сервер вернул пустой ответ.", "empty_response", 502);
    }
    options.onDelta?.(result.answer);
    return { answer: result.answer };
  });
}

/** Распознаёт речь (`POST /api/audio/transcribe`) и возвращает текст. */
export function transcribeVoice(chatId: number, file: Blob): Promise<string> {
  return request(async () => {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("file", file, file instanceof File ? file.name : "voice.webm");
    const data = parseData(
      await apiRequest("/api/audio/transcribe", {
        method: "POST",
        form,
        timeoutMs: apiConfig.timeoutsMs.transcribe,
      }),
      isTranscript,
    );
    return data.text.trim();
  });
}
