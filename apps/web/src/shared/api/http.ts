/** Ошибка запроса к backend: понятное пользователю сообщение, код и HTTP-статус. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code = "request_failed",
    readonly status = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
