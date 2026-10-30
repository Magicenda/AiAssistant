import { isIsoDate } from "@/shared/lib/date";
import type { MeetingItemDto, TaskItemDto } from "./types";

export function isTaskItemDto(value: unknown): value is TaskItemDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    (item.type === "task" || item.type === "notify") &&
    typeof item.description === "string" &&
    (item.deadline === null || isIsoDate(item.deadline)) &&
    isIsoDate(item.created_at)
  );
}

export function isMeetingItemDto(value: unknown): value is MeetingItemDto {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "number" &&
    typeof item.description === "string" &&
    isIsoDate(item.appointment) &&
    isIsoDate(item.created_at)
  );
}

export function isTaskList(value: unknown): value is TaskItemDto[] {
  return Array.isArray(value) && value.every(isTaskItemDto);
}

export function isMeetingList(value: unknown): value is MeetingItemDto[] {
  return Array.isArray(value) && value.every(isMeetingItemDto);
}
