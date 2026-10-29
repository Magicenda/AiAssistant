import { formatDuration } from "@/shared/lib/format-duration";
import type { Chat } from "@/entities/chat";

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

/** Собирает чат в Markdown-документ для экспорта. */
export function chatToMarkdown(chat: Chat) {
  const lines: string[] = [`# ${chat.title || "Новый чат"}`, ""];
  for (const message of chat.messages) {
    const author = message.role === "assistant" ? "Ассистент" : "Вы";
    const at = message.createdAt ? ` · ${timeFormat.format(message.createdAt)}` : "";
    lines.push(`**${author}**${at}`, "");
    if (message.replyTo) {
      lines.push(`> ${message.replyTo.text.replace(/\n+/g, " ")}`, "");
    }
    lines.push(
      message.audio
        ? `[Голосовое сообщение · ${formatDuration(message.audio.duration)}]`
        : message.text,
      "",
    );
  }
  return lines.join("\n");
}

/** Безопасное имя файла из названия чата. */
export function chatFileName(chat: Chat) {
  const base = (chat.title || "chat")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "chat"}.md`;
}

/** Скачивает чат как `.md` через временный `<a>`. */
export function downloadChat(chat: Chat) {
  const blob = new Blob([chatToMarkdown(chat)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = chatFileName(chat);
  link.click();
  URL.revokeObjectURL(url);
}
