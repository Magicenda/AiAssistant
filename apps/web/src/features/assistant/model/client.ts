import { ApiError as HttpApiError } from "@/shared/api/http";
import { ApiError as TransportApiError, apiRequest, parseData } from "@/shared/api";
import { apiConfig } from "@/shared/config";
import { isChatDto, isChatList, isLlmAnswer, type ChatDto, type ChatReply } from "@/entities/chat";
import { modelRequestSettings } from "@/entities/model-settings";
import { isTranscript } from "@/entities/voice";

export interface QueryOptions {
  /** Отмена запроса (кнопка «Остановить»). */
  signal?: AbortSignal;
  /** Полный ответ приходит одним JSON, колбэк вызывается один раз. */
  onDelta?: (text: string) => void;
  /** Цитата, на которую отвечает пользователь; сохраняется на backend. */
  replyTo?: ChatReply;
  /** Перегенерировать последний ответ без повторного сохранения вопроса. */
  regenerate?: boolean;
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

/** Все чаты пользователя вместе с сообщениями (`GET /api/chat/get_all_chats`). */
export function getAllChats(): Promise<ChatDto[]> {
  return request(async () => parseData(await apiRequest("/api/chat/get_all_chats"), isChatList));
}

/** Один чат с историей (`GET /api/chat/get_chat/{id}`). */
export function getChat(chatId: number): Promise<ChatDto> {
  return request(async () =>
    parseData(await apiRequest(`/api/chat/get_chat/${chatId}`), isChatDto),
  );
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

/** Переименовывает или закрепляет чат (`PATCH /api/chat/{id}`). */
export function updateRemoteChat(
  chatId: number,
  patch: { name_chat?: string; pinned?: boolean },
): Promise<ChatDto> {
  return request(async () =>
    parseData(await apiRequest(`/api/chat/${chatId}`, { method: "PATCH", body: patch }), isChatDto),
  );
}

/** Удаляет сообщение (`DELETE /api/chat/{id}/message/{message_id}`). */
export function deleteRemoteMessage(chatId: number, messageId: number): Promise<ChatDto> {
  return request(async () =>
    parseData(
      await apiRequest(`/api/chat/${chatId}/message/${messageId}`, { method: "DELETE" }),
      isChatDto,
    ),
  );
}

/** Очищает историю чата (`DELETE /api/chat/{id}/messages`). */
export function clearRemoteChat(chatId: number): Promise<ChatDto> {
  return request(async () =>
    parseData(await apiRequest(`/api/chat/${chatId}/messages`, { method: "DELETE" }), isChatDto),
  );
}

/** Добавляет сообщение вручную (`POST /api/chat/add_message/{id}`). */
export function addRemoteMessage(
  chatId: number,
  role: "user" | "assistant",
  content: string,
): Promise<ChatDto> {
  return request(async () =>
    parseData(
      await apiRequest(`/api/chat/add_message/${chatId}`, {
        method: "POST",
        search: { role, content },
      }),
      isChatDto,
    ),
  );
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
    const modelSettings = modelRequestSettings();
    const result = parseData(
      await apiRequest("/api/llm/query", {
        method: "POST",
        body: {
          chat_id: chatId,
          query,
          ...(options.replyTo ? { reply_to: options.replyTo } : {}),
          ...(options.regenerate ? { regenerate: true } : {}),
          // Без настроек backend использует GigaChat из своего env.
          ...(modelSettings ? { model_settings: modelSettings } : {}),
        },
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
