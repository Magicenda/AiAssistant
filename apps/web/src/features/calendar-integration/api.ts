import {
  isAppleCalendarStatusDto,
  isAppleSyncResultDto,
  isYandexAuthorizeResponseDto,
  isYandexCalendarStatusDto,
  isYandexSyncResultDto,
  type AppleCalendarStatusDto,
  type AppleSyncResultDto,
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

/** Получает статус подключения Apple Календаря. */
export async function getAppleCalendarStatus(): Promise<AppleCalendarStatusDto> {
  return parseData(await apiRequest("/api/calendar/apple/status"), isAppleCalendarStatusDto);
}

/** Подключает iCloud Календарь по Apple ID и паролю приложения. */
export async function connectAppleCalendar(
  appleId: string,
  appPassword: string,
): Promise<AppleCalendarStatusDto> {
  return parseData(
    await apiRequest("/api/calendar/apple/connect", {
      method: "POST",
      body: { apple_id: appleId, app_password: appPassword },
    }),
    isAppleCalendarStatusDto,
  );
}

/** Отключает Apple Календарь от профиля пользователя. */
export async function disconnectAppleCalendar(): Promise<AppleCalendarStatusDto> {
  return parseData(
    await apiRequest("/api/calendar/apple/disconnect", { method: "DELETE" }),
    isAppleCalendarStatusDto,
  );
}

/** Выгружает в Apple Календарь встречи и напоминания без apple_uid. */
export async function syncAppleCalendar(): Promise<AppleSyncResultDto> {
  return parseData(
    await apiRequest("/api/calendar/apple/sync", {
      method: "POST",
      timeoutMs: apiConfig.timeoutsMs.calendarSync,
    }),
    isAppleSyncResultDto,
  );
}
