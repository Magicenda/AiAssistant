import type { Chat, ChatAudio, ChatMessage, ChatReply, ChatRole } from "@/entities/chat";

const key = "assistant-chats-v1";

function toRole(value: unknown): ChatRole {
  return value === "assistant" ? "assistant" : "user";
}

function toAudio(value: unknown): ChatAudio | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.dataUrl !== "string" || typeof item.type !== "string" ||
    typeof item.duration !== "number") return undefined;
  return { dataUrl: item.dataUrl, type: item.type, duration: item.duration };
}

function toReply(value: unknown): ChatReply | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== "string" || typeof item.text !== "string") return undefined;
  return { id: item.id, role: toRole(item.role), text: item.text };
}

function toMessage(value: unknown): ChatMessage | null {
  if (typeof value === "string") return { id: crypto.randomUUID(), text: value, role: "user" };
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<ChatMessage>;
  if (typeof item.id !== "string" || typeof item.text !== "string") return null;
  return {
    id: item.id,
    text: item.text,
    role: toRole(item.role),
    createdAt: typeof item.createdAt === "number" ? item.createdAt : undefined,
    replyTo: toReply(item.replyTo),
    audio: toAudio(item.audio),
  };
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

/** Сохраняет чат и поднимает его в начало списка (последний активный — сверху). */
export function saveChat(next: Chat): Chat {
  const all = [next, ...readChats().filter(chat => chat.id !== next.id)];
  writeChats(all);
  return next;
}

export function updateChat(chatId: string, patch: Partial<Omit<Chat, "id">>): Chat | null {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat) return null;
  return saveChat({ ...chat, ...patch });
}

export function removeChat(chatId: string) {
  writeChats(readChats().filter(chat => chat.id !== chatId));
}

export function removeMessage(chatId: string, messageId: string): Chat | null {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat) return null;
  return saveChat({
    ...chat,
    messages: chat.messages.filter(message => message.id !== messageId),
  });
}

export function appendMessage(chatId: string, message: ChatMessage): Chat | null {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat) return null;
  return saveChat({ ...chat, messages: [...chat.messages, message] });
}
