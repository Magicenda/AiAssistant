import { ApiError } from "@/shared/api/http";
import { queryAssistant, type QueryResult } from "@/features/assistant";

import { appendMessage, readChats } from "./store";
import { ensureRemoteChat, resetRemoteChat } from "./remote";

export interface ReplyState {
  status: "streaming" | "error";
  text: string;
  error?: string;
  code?: string;
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

function lastUserText(chatId: string) {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat) return "";
  return [...chat.messages]
    .reverse()
    .find(message => message.role === "user" && message.text.trim())
    ?.text.trim() ?? "";
}

function savePartial(chatId: string, job: Job) {
  const text = job.state.text.trim();
  if (!text) return;
  appendMessage(chatId, {
    id: crypto.randomUUID(),
    role: "assistant",
    text,
    createdAt: Date.now(),
  });
}

function networkMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof TypeError) {
    return "Не удалось связаться с сервером ассистента. Проверьте адрес API в настройках.";
  }
  if (error instanceof Error) return error.message;
  return "Не удалось получить ответ. Проверьте подключение.";
}

export function subscribeReplies(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

export function getReply(chatId: string): ReplyState | null {
  return jobs.get(chatId)?.state ?? null;
}

/** Отправляет последнее сообщение пользователя на backend и стримит ответ. */
export function requestReply(chatId: string) {
  const previous = jobs.get(chatId);
  if (previous) {
    previous.controller.abort();
    jobs.delete(chatId);
  }

  const query = lastUserText(chatId);
  const job: Job = {
    controller: new AbortController(),
    state: { status: "streaming", text: "" },
    keepPartial: false,
  };
  jobs.set(chatId, job);
  notify();

  if (!query) {
    update(chatId, job, {
      status: "error",
      text: "",
      error: "В чате нет сообщения пользователя для отправки.",
      code: "empty_chat",
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
      let remoteId = await ensureRemoteChat(chatId);
      let result: QueryResult;
      try {
        result = await queryAssistant(remoteId, query, { signal, onDelta });
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 404) throw error;
        await resetRemoteChat(chatId);
        remoteId = await ensureRemoteChat(chatId);
        update(chatId, job, { status: "streaming", text: "" });
        result = await queryAssistant(remoteId, query, { signal, onDelta });
      }

      if (jobs.get(chatId) !== job) return;
      const text = result.answer.trim() || job.state.text.trim();
      if (!text) {
        update(chatId, job, {
          status: "error",
          text: "",
          error: "Сервер вернул пустой ответ. Попробуйте ещё раз.",
          code: "empty_response",
        });
        return;
      }
      drop(chatId, job);
      appendMessage(chatId, {
        id: crypto.randomUUID(),
        role: "assistant",
        text,
        createdAt: Date.now(),
      });
    } catch (error) {
      if (jobs.get(chatId) !== job) return;
      const aborted = error instanceof DOMException && error.name === "AbortError";
      if (aborted) {
        if (job.keepPartial) savePartial(chatId, job);
        drop(chatId, job);
        return;
      }
      update(chatId, job, {
        status: "error",
        text: job.state.text,
        error: networkMessage(error),
        code: error instanceof ApiError ? error.code : "network_error",
      });
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
