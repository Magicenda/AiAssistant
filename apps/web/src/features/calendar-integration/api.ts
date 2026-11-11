import {
  isYandexCalendarStatusDto,
  isYandexSyncResultDto,
  type YandexCalendarStatusDto,
  type YandexConnectInputDto,
  type YandexSyncResultDto,
} from "@/entities/calendar";
import { apiRequest, parseData } from "@/shared/api";
import { apiConfig } from "@/shared/config";

/** Получает текущий статус подключения Яндекс.Календаря. */
export async function getYandexCalendarStatus(): Promise<YandexCalendarStatusDto> {
  return parseData(await apiRequest("/api/calendar/yandex/status"), isYandexCalendarStatusDto);
}

/** Подключает Яндекс.Календарь по логину и паролю приложения. */
export async function connectYandexCalendar(
  input: YandexConnectInputDto,
): Promise<YandexCalendarStatusDto> {
  return parseData(
    await apiRequest("/api/calendar/yandex/connect", { method: "POST", body: input }),
    isYandexCalendarStatusDto,
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
