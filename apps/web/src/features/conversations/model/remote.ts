import { createRemoteChat, deleteRemoteChat } from "@/features/assistant";

import { readChats, updateChat } from "./store";

const pending = new Map<string, Promise<number>>();

/** Создаёт чат на backend при первом обращении и запоминает его id. */
export function ensureRemoteChat(chatId: string): Promise<number> {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat) return Promise.reject(new Error("Чат не найден."));
  if (chat.remoteId) return Promise.resolve(chat.remoteId);

  const existing = pending.get(chatId);
  if (existing) return existing;

  const request = createRemoteChat(chat.title || "Новый чат")
    .then(remoteId => {
      updateChat(chatId, { remoteId }, { touch: false });
      return remoteId;
    })
    .finally(() => pending.delete(chatId));

  pending.set(chatId, request);
  return request;
}

/** Забывает backend-чат, чтобы следующий запрос создал новый. */
export async function resetRemoteChat(chatId: string) {
  pending.delete(chatId);
  const chat = readChats().find(item => item.id === chatId);
  if (!chat?.remoteId) return;
  updateChat(chatId, { remoteId: undefined }, { touch: false });
  await deleteRemoteChat(chat.remoteId).catch(() => undefined);
}

/** Удаляет backend-чат, не дожидаясь ответа. */
export function removeRemoteChat(chatId: string) {
  const chat = readChats().find(item => item.id === chatId);
  if (!chat?.remoteId) return;
  void deleteRemoteChat(chat.remoteId).catch(() => undefined);
}
