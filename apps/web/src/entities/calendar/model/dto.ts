import { isIsoDate } from "@/shared/lib/date";
import type {
  YandexAuthorizeResponseDto,
  YandexCalendarStatusDto,
  YandexSyncResultDto,
} from "./types";

/** Проверяет, что backend вернул статус Яндекс.Календаря в ожидаемом формате. */
export function isYandexCalendarStatusDto(value: unknown): value is YandexCalendarStatusDto {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  return (
    typeof status.connected === "boolean" &&
    (status.login === null || typeof status.login === "string") &&
    (status.connected_at === null || isIsoDate(status.connected_at))
  );
}

/** Проверяет ответ authorize: нужен URL окна OAuth. */
export function isYandexAuthorizeResponseDto(value: unknown): value is YandexAuthorizeResponseDto {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.authorize_url === "string" && row.authorize_url.length > 0;
}

/** Проверяет, что backend вернул итог синхронизации календаря в ожидаемом формате. */
export function isYandexSyncResultDto(value: unknown): value is YandexSyncResultDto {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.meetings === "number" &&
    typeof result.reminders === "number" &&
    typeof result.failed === "number"
  );
}
