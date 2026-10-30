import { ApiError as HttpApiError } from "@/shared/api/http";
import { ApiError as TransportApiError, apiBlob, apiRequest, parseData } from "@/shared/api";
import { apiConfig } from "@/shared/config";
import { isChatDto, isChatList, isLlmAnswer, type ChatDto, type ChatReply } from "@/entities/chat";
import { modelRequestSettings } from "@/entities/model-settings";
import {
  isJobCreated,
  isSpeechStream,
  isTranscript,
  isVoiceJob,
  type VoiceJob,
} from "@/entities/voice";

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

/**
 * Запускает полный голосовой цикл (`POST /api/voice/ask`):
 * распознавание речи, ответ ассистента и озвучка в одном job.
 *
 * @param chatId - id чата, в который попадут вопрос и ответ.
 * @param file - запись с микрофона.
 * @param speak - синтезировать ли ответ на сервере (голосовой режим озвучивает сам).
 * @param signal - отмена запроса.
 * @returns id задачи, за которой нужно следить через `getSpeechJob`.
 */
export function askByVoice(
  chatId: number,
  file: Blob,
  speak = true,
  signal?: AbortSignal,
): Promise<string> {
  return request(async () => {
    const form = new FormData();
    form.append("chat_id", String(chatId));
    form.append("file", file, file instanceof File ? file.name : "voice.webm");
    form.append("speak", String(speak));
    const settings = modelRequestSettings();
    // Backend ждёт JSON-строку в form-поле: модель та же, что выбрана в настройках.
    if (settings) form.append("model_settings", JSON.stringify(settings));
    const data = parseData(
      await apiRequest("/api/voice/ask", {
        method: "POST",
        form,
        signal,
        timeoutMs: apiConfig.timeoutsMs.audioUpload,
      }),
      isJobCreated,
    );
    return data.job_id;
  });
}

/** Создаёт задачу озвучки текста (`POST /api/voice/generate`) и возвращает её id. */
export function generateSpeech(text: string, signal?: AbortSignal): Promise<string> {
  return request(async () => {
    const data = parseData(
      await apiRequest("/api/voice/generate", {
        method: "POST",
        body: { text },
        signal,
      }),
      isJobCreated,
    );
    return data.job_id;
  });
}

/** Статус задачи озвучки (`GET /api/voice/jobs/{id}`). */
export function getSpeechJob(jobId: string, signal?: AbortSignal): Promise<VoiceJob> {
  return request(async () =>
    parseData(
      await apiRequest(`/api/voice/jobs/${jobId}`, {
        signal,
        timeoutMs: apiConfig.timeoutsMs.jobStatus,
      }),
      isVoiceJob,
    ),
  );
}

/** Готовое аудио озвучки (`GET /api/voice/jobs/{id}/audio`); нужен токен, поэтому blob через fetch. */
export function getSpeechAudio(jobId: string, signal?: AbortSignal): Promise<Blob> {
  return request(() =>
    apiBlob(`/api/voice/jobs/${jobId}/audio`, {
      signal,
      timeoutMs: apiConfig.timeoutsMs.audioUpload,
    }),
  );
}

/**
 * Создаёт потоковую озвучку (`POST /api/voice/stream`).
 * Возвращённую ссылку можно сразу ставить в `<audio src>` — звук пойдёт по мере синтеза.
 *
 * @param text - текст ответа.
 * @param signal - отмена создания ссылки.
 * @returns Абсолютный URL потока и время его жизни.
 */
export function createSpeechStream(
  text: string,
  signal?: AbortSignal,
): Promise<{ url: string; expiresIn: number }> {
  return request(async () => {
    const data = parseData(
      await apiRequest("/api/voice/stream", {
        method: "POST",
        body: { text },
        signal,
      }),
      isSpeechStream,
    );
    return {
      url: `${apiConfig.baseUrl}${data.stream_url}`,
      expiresIn: data.expires_in,
    };
  });
}

/** Ждёт паузу между опросами задачи озвучки; отмена пробрасывается как `AbortError`. */
function waitForPoll(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Озвучивает текст: создаёт job, опрашивает статус и скачивает mp3.
 *
 * @param text - текст ответа ассистента.
 * @param signal - отмена ожидания (например, пользователь нажал «Стоп»).
 * @returns Аудиофайл для проигрывания через `URL.createObjectURL`.
 */
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const jobId = await generateSpeech(text, signal);
  const deadline = Date.now() + apiConfig.limits.jobPollTimeoutMs;
  while (Date.now() < deadline) {
    const job = await getSpeechJob(jobId, signal);
    if (job.status === "completed") return await getSpeechAudio(jobId, signal);
    if (job.status === "failed") {
      throw new HttpApiError(job.error || "Не удалось озвучить ответ.", "speech_failed", 502);
    }
    await waitForPoll(apiConfig.limits.jobPollIntervalMs, signal);
  }
  throw new HttpApiError("Озвучка не успела подготовиться.", "speech_timeout", 504);
}
