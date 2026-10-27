import { appendMessage } from "./store";

// Пока бэкенда нет, ассистент «отвечает» эхом на сообщение пользователя.
// Ожидание хранится в модуле, чтобы индикатор переживал переход на /chat/[id].
const pending = new Map<string, number>();
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
  window.setTimeout(() => {
    appendMessage(chatId, {
      id: crypto.randomUUID(),
      role: "assistant",
      text: text.trim() || "Голосовое сообщение",
      createdAt: Date.now(),
    });
    shift(chatId, -1);
  }, delay);
}
