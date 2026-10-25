import type { Chat, ChatMessage } from "@/entities/chat";

const key = "assistant-chats-v1";

function toMessage(value: unknown): ChatMessage | null {
  if (typeof value === "string") return { id: crypto.randomUUID(), text: value };
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ChatMessage>;
  if (typeof item.id !== "string" || typeof item.text !== "string") return null;
  return { id: item.id, text: item.text };
}

export function readChats(): Chat[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const chat = item as Partial<Chat>;
      if (typeof chat.id !== "string" || typeof chat.title !== "string" ||
        !Array.isArray(chat.messages)) return [];
      return [{
        id: chat.id,
        title: chat.title,
        messages: chat.messages.map(toMessage)
          .filter((message): message is ChatMessage => message !== null),
      }];
    });
  } catch { return []; }
}

export function writeChats(chats: Chat[]) {
  localStorage.setItem(key, JSON.stringify(chats));
  window.dispatchEvent(new Event("chats-change"));
}
