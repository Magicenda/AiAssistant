import { isIsoDate } from "@/shared/lib/date";
import type {
  Chat,
  ChatDto,
  ChatMessage,
  ChatMessageDto,
  ChatMessageRole,
  ChatReplyDto,
  LlmAnswer,
} from "./types";

const ROLES: ReadonlySet<string> = new Set(["user", "assistant", "system", "tool"]);

function isChatMessageRole(value: unknown): value is ChatMessageRole {
  return typeof value === "string" && ROLES.has(value);
}

function isChatReplyDto(value: unknown): value is ChatReplyDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return isChatMessageRole(item.role) && typeof item.text === "string";
}

export function isChatMessageDto(value: unknown): value is ChatMessageDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    isChatMessageRole(item.role) &&
    typeof item.content === "string" &&
    isIsoDate(item.created_at) &&
    (item.reply_to === undefined || item.reply_to === null || isChatReplyDto(item.reply_to))
  );
}

export function isChatDto(value: unknown): value is ChatDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.chat_id === "number" &&
    typeof item.name_chat === "string" &&
    Array.isArray(item.messages) &&
    item.messages.every(isChatMessageDto) &&
    (item.pinned === undefined || typeof item.pinned === "boolean")
  );
}

export function isChatList(value: unknown): value is ChatDto[] {
  return Array.isArray(value) && value.every(isChatDto);
}

export function isLlmAnswer(value: unknown): value is LlmAnswer {
  if (!value || typeof value !== "object") return false;
  return typeof (value as Record<string, unknown>).answer === "string";
}

function messageDtoToDomain(dto: ChatMessageDto): ChatMessage {
  return {
    id: String(dto.id),
    text: dto.content,
    role: dto.role === "user" ? "user" : "assistant",
    createdAt: Date.parse(dto.created_at),
    replyTo: dto.reply_to
      ? {
          id: dto.reply_to.id ?? "",
          role: dto.reply_to.role === "assistant" ? "assistant" : "user",
          text: dto.reply_to.text,
        }
      : undefined,
  };
}

/** Переводит DTO чата в доменную модель; id чата и сообщений — строки backend. */
export function chatDtoToDomain(dto: ChatDto): Chat {
  const messages = dto.messages.map(messageDtoToDomain);
  return {
    id: String(dto.chat_id),
    title: dto.name_chat,
    messages,
    pinned: dto.pinned === true,
    updatedAt: messages.at(-1)?.createdAt ?? 0,
  };
}
