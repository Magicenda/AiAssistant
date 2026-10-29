import { isIsoDate } from "@/shared/lib/date";
import type {
  Chat,
  ChatDto,
  ChatMessage,
  ChatMessageDto,
  ChatMessageRole,
  LlmAnswer,
} from "./types";

const ROLES: ReadonlySet<string> = new Set(["user", "assistant", "system", "tool"]);

function isChatMessageRole(value: unknown): value is ChatMessageRole {
  return typeof value === "string" && ROLES.has(value);
}

export function isChatMessageDto(value: unknown): value is ChatMessageDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "number" &&
    isChatMessageRole(item.role) &&
    typeof item.content === "string" &&
    isIsoDate(item.created_at);
}

export function isChatDto(value: unknown): value is ChatDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.chat_id === "number" &&
    typeof item.name_chat === "string" &&
    Array.isArray(item.messages) &&
    item.messages.every(isChatMessageDto);
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
  };
}

export function chatDtoToDomain(dto: ChatDto): Chat {
  return {
    id: String(dto.chat_id),
    title: dto.name_chat,
    messages: dto.messages.map(messageDtoToDomain),
  };
}
