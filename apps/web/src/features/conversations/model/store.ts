export type Chat = { id: string; title: string; messages: string[] };
const key = "assistant-chats-v1";
export function readChats(): Chat[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((chat): chat is Chat => chat && typeof chat.id === "string" &&
      typeof chat.title === "string" && Array.isArray(chat.messages) &&
      chat.messages.every((message: unknown) => typeof message === "string"));
  } catch { return []; }
}
export function writeChats(chats: Chat[]) {
  localStorage.setItem(key, JSON.stringify(chats));
  window.dispatchEvent(new Event("chats-change"));
}
