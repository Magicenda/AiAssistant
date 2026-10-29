import type { Chat, ChatAudio } from "@/entities/chat";

// Голосовые вложения backend не хранит: тексты живут на сервере, а аудио —
// локальный оверлей по id сообщения, чтобы плеер работал после перезагрузки.
const key = "assistant-audio-v1";

type AudioIndex = Record<string, ChatAudio>;

function readIndex(): AudioIndex {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as AudioIndex;
  } catch {
    return {};
  }
}

function writeIndex(index: AudioIndex) {
  try {
    localStorage.setItem(key, JSON.stringify(index));
  } catch {
    /* Лимит localStorage: аудио не критично для работы чата. */
  }
}

const messageKey = (chatId: string, messageId: string) => `${chatId}:${messageId}`;

// Запись, которую ещё не к чему привязать: сообщение появится после ответа сервера.
const queued = new Map<string, ChatAudio>();

/** Запоминает аудио до того, как сообщение придёт с backend. */
export function queueAudio(chatId: string, text: string, audio: ChatAudio) {
  queued.set(`${chatId}:${text}`, audio);
}

/** Забирает отложенное аудио для текста сообщения. */
export function takeQueuedAudio(chatId: string, text: string): ChatAudio | undefined {
  const key = `${chatId}:${text}`;
  const audio = queued.get(key);
  if (audio) queued.delete(key);
  return audio;
}

/** Приклеивает сохранённые голосовые вложения к сообщениям чата. */
export function attachAudio(chat: Chat): Chat {
  const index = readIndex();
  const messages = chat.messages.map(message => {
    const audio = index[messageKey(chat.id, message.id)];
    return audio ? { ...message, audio } : message;
  });
  return { ...chat, messages };
}

/** Сохраняет запись для конкретного сообщения. */
export function saveMessageAudio(chatId: string, messageId: string, audio: ChatAudio) {
  const index = readIndex();
  index[messageKey(chatId, messageId)] = audio;
  writeIndex(index);
}

/** Удаляет вложение сообщения или все вложения чата. */
export function removeAudio(chatId: string, messageId?: string) {
  const index = readIndex();
  const prefix = `${chatId}:`;
  let changed = false;
  for (const field of Object.keys(index)) {
    if (messageId ? field === prefix + messageId : field.startsWith(prefix)) {
      delete index[field];
      changed = true;
    }
  }
  if (changed) writeIndex(index);
}
