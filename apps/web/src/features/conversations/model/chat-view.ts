import type { ChatMessage } from "@/entities/chat";

const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dayYearFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayMs = 86_400_000;

export function dayKey(value?: number) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(value: number, now = Date.now()) {
  const key = dayKey(value);
  if (key === dayKey(now)) return "Сегодня";
  if (key === dayKey(now - dayMs)) return "Вчера";
  const date = new Date(value);
  return date.getFullYear() === new Date(now).getFullYear()
    ? dayFormat.format(date)
    : dayYearFormat.format(date);
}

export interface MessageItem {
  message: ChatMessage;
  /** Сообщение продолжает предыдущее сообщение того же автора за тот же день. */
  grouped: boolean;
  /** Последнее сообщение в группе — у него показываем время. */
  lastInGroup: boolean;
  separator?: string;
}

export function buildMessageItems(messages: ChatMessage[]): MessageItem[] {
  return messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const sameGroup = (a?: ChatMessage, b?: ChatMessage) =>
      Boolean(a && b && a.role === b.role && dayKey(a.createdAt) === dayKey(b.createdAt));
    const key = dayKey(message.createdAt);
    return {
      message,
      grouped: sameGroup(previous, message),
      lastInGroup: !sameGroup(message, next),
      separator:
        message.createdAt && key !== dayKey(previous?.createdAt)
          ? dayLabel(message.createdAt)
          : undefined,
    };
  });
}
