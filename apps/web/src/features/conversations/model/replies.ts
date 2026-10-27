import { appendMessage } from "./store";

// Пока бэкенда нет, ассистент «отвечает» эхом на сообщение пользователя.
// Ожидание хранится в модуле, чтобы индикатор переживал переход на /chat/[id].
const pending = new Map<string, number>();
const timers = new Map<string, Set<number>>();
const event = "conversation-replies";

function notify() {
  window.dispatchEvent(new Event(event));
}

function shift(chatId: string, delta: number) {
  const next = (pending.get(chatId) ?? 0) + delta;
  if (next > 0) pending.set(chatId, next);
  else pending.delete(chatId);
  notify();
}

function untrack(chatId: string, timer: number) {
  const set = timers.get(chatId);
  if (!set) return;
  set.delete(timer);
  if (!set.size) timers.delete(chatId);
}

export function subscribeReplies(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

export function isReplyPending(chatId: string) {
  return pending.has(chatId);
}

/** Ставит эхо-ответ в очередь: длинный текст «печатается» чуть дольше. */
export function requestReply(chatId: string, text: string) {
  shift(chatId, 1);
  const delay = Math.min(1600, 500 + text.length * 4);
  const timer = window.setTimeout(() => {
    const message = {
      id: crypto.randomUUID(),
      role: "assistant" as const,
      text: text.trim() || "Голосовое сообщение",
      createdAt: Date.now(),
    };
    appendMessage(chatId, message);
    untrack(chatId, timer);
    shift(chatId, -1);
  }, delay);
  const set = timers.get(chatId) ?? new Set<number>();
  set.add(timer);
  timers.set(chatId, set);
}

/** Отменяет все отложенные ответы чата (например, при редактировании сообщения). */
export function cancelReplies(chatId: string) {
  const set = timers.get(chatId);
  if (set) {
    for (const timer of set) window.clearTimeout(timer);
    timers.delete(chatId);
  }
  if (pending.has(chatId)) {
    pending.delete(chatId);
    notify();
  }
}
