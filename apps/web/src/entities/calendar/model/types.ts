/** Статус подключения Яндекс.Календаря к профилю пользователя. */
export interface YandexCalendarStatusDto {
  /** Подключён ли календарь. */
  connected: boolean;
  /** Логин Яндекса, если календарь подключён. */
  login: string | null;
  /** Момент подключения в ISO 8601. */
  connected_at: string | null;
}

/** Данные для подключения Яндекс.Календаря. */
export interface YandexConnectInputDto {
  /** Email Яндекса. */
  login: string;
  /** Пароль приложения «Календарь», а не основной пароль аккаунта. */
  app_password: string;
}

/** Итог выгрузки существующих записей в Яндекс.Календарь. */
export interface YandexSyncResultDto {
  /** Сколько встреч добавлено в календарь. */
  meetings: number;
  /** Сколько напоминаний добавлено в календарь. */
  reminders: number;
  /** Сколько записей не удалось добавить. */
  failed: number;
}
