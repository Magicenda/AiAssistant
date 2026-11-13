/** Статус подключения Яндекс.Календаря к профилю пользователя. */
export interface YandexCalendarStatusDto {
  /** Подключён ли календарь. */
  connected: boolean;
  /** Логин Яндекса, если календарь подключён. */
  login: string | null;
  /** Момент подключения в ISO 8601. */
  connected_at: string | null;
}

/** Ответ backend с URL окна Яндекс OAuth. */
export interface YandexAuthorizeResponseDto {
  /** URL страницы согласия Яндекс ID. */
  authorize_url: string;
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
