import type { Chat } from "@/entities/chat";
import { dayKey } from "./chat-view";

const dayMs = 86_400_000;
const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const shortFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" });
const weekdayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "short" });
const fullFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Дата последней активности: явная или от последнего сообщения. */
export function chatTimestamp(chat: Chat) {
  return chat.updatedAt ?? chat.messages.at(-1)?.createdAt ?? 0;
}

/** Сортирует чаты: закреплённые сверху, затем по свежести. */
export function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return chatTimestamp(b) - chatTimestamp(a);
  });
}

/** Фильтрует чаты по названию и тексту сообщений. */
export function filterChats(chats: Chat[], query: string) {
  const value = query.trim().toLowerCase();
  if (!value) return chats;
  return chats.filter(
    chat =>
      chat.title.toLowerCase().includes(value) ||
      chat.messages.some(message => message.text.toLowerCase().includes(value)),
  );
}

/** Метка даты: время для сегодня, «вчера», день недели или дата. */
export function chatDateLabel(value: number, now = Date.now()) {
  if (!value) return "";
  if (dayKey(value) === dayKey(now)) return timeFormat.format(value);
  if (dayKey(value) === dayKey(now - dayMs)) return "вчера";
  if (now - value < 7 * dayMs) return weekdayFormat.format(value);
  const date = new Date(value);
  if (date.getFullYear() === new Date(now).getFullYear()) return shortFormat.format(value);
  return fullFormat.format(value);
}

export interface ChatGroup {
  key: string;
  label: string;
  chats: Chat[];
}

/** Группирует уже отсортированные чаты по давности. */
export function groupChats(chats: Chat[], now = Date.now()): ChatGroup[] {
  const groups: ChatGroup[] = [];
  for (const chat of chats) {
    const value = chatTimestamp(chat);
    const label = !value
      ? "Раньше"
      : dayKey(value) === dayKey(now)
        ? "Сегодня"
        : dayKey(value) === dayKey(now - dayMs)
          ? "Вчера"
          : now - value < 7 * dayMs
            ? "На этой неделе"
            : "Раньше";
    const last = groups.at(-1);
    if (last?.label === label) last.chats.push(chat);
    else groups.push({ key: `${label}:${groups.length}`, label, chats: [chat] });
  }
  return groups;
}
