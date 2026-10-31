import { chatDtoToDomain, type Chat } from "@/entities/chat";
import {
  addRemoteMessage,
  clearRemoteChat,
  createRemoteChat,
  deleteRemoteChat,
  deleteRemoteMessage,
  getAllChats,
  getChat,
  updateRemoteChat,
} from "@/features/assistant";
// Чаты и сообщения — на backend. В памяти держим кэш для синхронного рендера,
// а localStorage используем только для черновиков и настроек.
const event = "chats-change";
const empty: Chat[] = [];

let cache: Chat[] = empty;
let loaded = false;

function emit() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(event));
}

function put(chat: Chat) {
  cache = [chat, ...cache.filter(item => item.id !== chat.id)];
  emit();
}

/** Подписка на изменения кэша чатов; возвращает функцию отписки. */
export function subscribeChats(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

/** Текущий кэш чатов; на сервере всегда пустой. */
export function readChats(): Chat[] {
  return cache;
}

/** Загружены ли чаты с backend хотя бы раз. */
export function isChatsLoaded() {
  return loaded;
}

/** Удаляет устаревшее хранилище аудиозаписей: плеера голосовых больше нет. */
function removeLegacyAudio() {
  try {
    localStorage.removeItem("assistant-audio-v1");
  } catch {
    /* Приватный режим или запрет storage: очистка не критична. */
  }
}

/** Загружает все чаты с backend и заменяет кэш. */
export async function loadChats(): Promise<Chat[]> {
  const dtos = await getAllChats();
  cache = dtos.map(chatDtoToDomain);
  loaded = true;
  removeLegacyAudio();
  emit();
  return cache;
}

/** Создаёт чат на backend и сразу кладёт его в кэш. */
export async function createChat(title: string): Promise<Chat> {
  const name = title.trim() || "Новый чат";
  const id = await createRemoteChat(name);
  const chat: Chat = { id: String(id), title: name, messages: [], updatedAt: 0 };
  put(chat);
  return chat;
}

/** Переименовывает чат. */
export async function renameChat(chatId: string, title: string) {
  put(chatDtoToDomain(await updateRemoteChat(Number(chatId), { name_chat: title })));
}

/** Закрепляет или открепляет чат. */
export async function setChatPinned(chatId: string, pinned: boolean) {
  put(chatDtoToDomain(await updateRemoteChat(Number(chatId), { pinned })));
}

/** Удаляет чат вместе с историей. */
export async function deleteChat(chatId: string) {
  await deleteRemoteChat(Number(chatId));
  cache = cache.filter(item => item.id !== chatId);
  emit();
}

/** Удаляет одно сообщение. */
export async function deleteChatMessage(chatId: string, messageId: string) {
  put(chatDtoToDomain(await deleteRemoteMessage(Number(chatId), Number(messageId))));
}

/** Очищает историю чата, оставляя сам чат. */
export async function clearChatMessages(chatId: string) {
  put(chatDtoToDomain(await clearRemoteChat(Number(chatId))));
}

/** Перечитывает один чат с backend (после ответа ассистента). */
export async function refreshChat(chatId: string): Promise<Chat | null> {
  const chat = chatDtoToDomain(await getChat(Number(chatId)));
  put(chat);
  return chat;
}

/** Сохраняет сообщение вручную — для частичного ответа после остановки. */
export async function appendChatMessage(
  chatId: string,
  role: "user" | "assistant",
  text: string,
): Promise<Chat> {
  const chat = chatDtoToDomain(await addRemoteMessage(Number(chatId), role, text));
  put(chat);
  return chat;
}
