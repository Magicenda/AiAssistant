import { ApiError } from "@/shared/api/http";
import { queryAssistant, type QueryResult } from "@/features/assistant";
import type { ChatReply } from "@/entities/chat";

import { appendChatMessage, refreshChat } from "./store";

/** Живое состояние генерации ответа, наблюдаемое через подписку. */
export interface ReplyState {
  /** `streaming` — генерация идёт, `error` — завершилась ошибкой. */
  status: "streaming" | "error";
  /** Накопленный текст ответа. */
  text: string;
  /** Вопрос, который ещё не подтверждён сервером — для оптимистичного пузыря. */
  query?: string;
  /** Цитата, приложенная к вопросу. */
  replyTo?: ChatReply;
  /** Сообщение об ошибке для показа в чате. */
  error?: string;
  /** Машинный код ошибки из `ApiError`. */
  code?: string;
}

interface ReplyOptions {
  /** Цитата, на которую отвечает пользователь. */
  replyTo?: ChatReply;
}

interface Job {
  controller: AbortController;
  state: ReplyState;
  keepPartial: boolean;
}

const jobs = new Map<string, Job>();
const event = "conversation-replies";

function notify() {
  window.dispatchEvent(new Event(event));
}

function update(chatId: string, job: Job, state: ReplyState) {
  if (jobs.get(chatId) !== job) return;
  job.state = state;
  notify();
}

function drop(chatId: string, job: Job) {
  if (jobs.get(chatId) !== job) return;
  jobs.delete(chatId);
  notify();
}

function networkMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Не удалось связаться с сервером ассистента. Проверьте адрес API в настройках.";
  }
  if (error instanceof Error) return error.message;
  return "Не удалось получить ответ. Проверьте подключение.";
}

/** Подписка на изменения генерации; возвращает функцию отписки. */
export function subscribeReplies(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

/** Текущее состояние генерации для чата или `null`, если она не идёт. */
export function getReply(chatId: string): ReplyState | null {
  return jobs.get(chatId)?.state ?? null;
}

/**
 * Отправляет вопрос на backend и стримит ответ.
 *
 * @param chatId - id чата на backend.
 * @param query - текст вопроса.
 * @param options - цитата, приложенная к вопросу.
 */
export function requestReply(chatId: string, query: string, options: ReplyOptions = {}) {
  const previous = jobs.get(chatId);
  if (previous) {
    previous.controller.abort();
    jobs.delete(chatId);
  }

  const trimmed = query.trim();
  const job: Job = {
    controller: new AbortController(),
    state: {
      status: "streaming",
      text: "",
      query: trimmed,
      replyTo: options.replyTo,
    },
    keepPartial: false,
  };
  jobs.set(chatId, job);
  notify();

  if (!trimmed) {
    update(chatId, job, {
      ...job.state,
      status: "error",
      error: "Введите текст вопроса.",
      code: "empty_query",
    });
    return;
  }

  const signal = job.controller.signal;
  const onDelta = (text: string) => {
    if (jobs.get(chatId) !== job || job.state.status !== "streaming") return;
    update(chatId, job, { ...job.state, text: job.state.text + text });
  };

  void (async () => {
    try {
      const result: QueryResult = await queryAssistant(Number(chatId), trimmed, {
        signal,
        onDelta,
        replyTo: options.replyTo,
      });

      if (jobs.get(chatId) !== job) return;
      const text = result.answer.trim() || job.state.text.trim();
      if (!text) {
        update(chatId, job, {
          ...job.state,
          status: "error",
          error: "Сервер вернул пустой ответ. Попробуйте ещё раз.",
          code: "empty_response",
        });
        return;
      }

      // Ответ уже сохранён backend'ом вместе с вопросом — перечитываем чат.
      // В текстовом режиме ответ не озвучивается: голос живёт только в голосовом чате.
      try {
        await refreshChat(chatId);
      } catch (error) {
        update(chatId, job, {
          ...job.state,
          status: "error",
          text,
          error: networkMessage(error),
          code: error instanceof ApiError ? error.code : "refresh_error",
        });
        return;
      }
      drop(chatId, job);
    } catch (error) {
      if (jobs.get(chatId) !== job) return;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (aborted) {
        if (job.keepPartial) {
          const text = job.state.text.trim();
          if (text) {
            void appendChatMessage(chatId, "assistant", text)
              .catch(() => undefined)
              .finally(() => drop(chatId, job));
            return;
          }
        }
        drop(chatId, job);
        return;
      }
      update(chatId, job, {
        ...job.state,
        status: "error",
        text: job.state.text,
        error: networkMessage(error),
        code: error instanceof ApiError ? error.code : "network_error",
      });
      // Backend мог успеть сохранить часть истории — синхронизируем кэш.
      void refreshChat(chatId).catch(() => undefined);
    }
  })();
}

/** Останавливает генерацию и сохраняет уже полученный текст. */
export function stopReply(chatId: string) {
  const job = jobs.get(chatId);
  if (!job) return;
  job.keepPartial = true;
  job.controller.abort();
}

/** Отменяет генерацию и выбрасывает частичный ответ. */
export function cancelReplies(chatId: string) {
  const job = jobs.get(chatId);
  jobs.delete(chatId);
  job?.controller.abort();
  notify();
}
