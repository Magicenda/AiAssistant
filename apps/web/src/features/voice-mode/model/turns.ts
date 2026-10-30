import { plainText } from "@/shared/lib/plain-text";
import type { ChatMessageDto } from "@/entities/chat";

/** Реплика голосового диалога для панели истории. */
export interface VoiceTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/**
 * Заголовок голосового чата по первой фразе пользователя.
 *
 * @param value - распознанная речь.
 * @returns Очищенный от markdown заголовок до 48 символов.
 */
export function voiceChatTitle(value: string) {
  const line = value.split("\n").find(item => item.trim()) ?? value;
  const clean = plainText(line);
  if (!clean) return "Голосовой чат";
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

/**
 * Переводит историю чата в реплики голосового экрана.
 *
 * @param messages - сообщения из `GET /chat/get_chat/{id}`.
 * @returns Только реплики пользователя и ассистента с непустым текстом.
 */
export function turnsFromHistory(messages: ChatMessageDto[]): VoiceTurn[] {
  const turns: VoiceTurn[] = [];
  for (const message of messages) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    if (!message.content.trim()) continue;
    turns.push({ id: `history-${message.id}`, role: message.role, text: message.content });
  }
  return turns;
}
