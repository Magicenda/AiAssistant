import {
  isYandexAuthorizeResponseDto,
  isYandexCalendarStatusDto,
  isYandexSyncResultDto,
  type YandexAuthorizeResponseDto,
  type YandexCalendarStatusDto,
  type YandexSyncResultDto,
} from "@/entities/calendar";
import { apiRequest, parseData } from "@/shared/api";
import { apiConfig } from "@/shared/config";

/** Получает текущий статус подключения Яндекс.Календаря. */
export async function getYandexCalendarStatus(): Promise<YandexCalendarStatusDto> {
  return parseData(await apiRequest("/api/calendar/yandex/status"), isYandexCalendarStatusDto);
}

/** Возвращает URL окна Яндекс OAuth для подключения календаря. */
export async function authorizeYandexCalendar(): Promise<YandexAuthorizeResponseDto> {
  return parseData(
    await apiRequest("/api/calendar/yandex/authorize"),
    isYandexAuthorizeResponseDto,
  );
}

/** Отключает Яндекс.Календарь от профиля пользователя. */
export async function disconnectYandexCalendar(): Promise<YandexCalendarStatusDto> {
  return parseData(
    await apiRequest("/api/calendar/yandex/disconnect", { method: "DELETE" }),
    isYandexCalendarStatusDto,
  );
}

/** Выгружает в календарь встречи и напоминания, созданные до подключения. */
export async function syncYandexCalendar(): Promise<YandexSyncResultDto> {
  return parseData(
    await apiRequest("/api/calendar/yandex/sync", {
      method: "POST",
      timeoutMs: apiConfig.timeoutsMs.calendarSync,
    }),
    isYandexSyncResultDto,
  );
}
