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

interface ErrorShape {
  message?: unknown;
  error?: unknown;
  detail?: unknown;
  code?: unknown;
}

/** Разбирает тело ошибки (`message`, `detail` FastAPI) в `ApiError` по статусу. */
export async function readApiError(response: Response): Promise<ApiError> {
  let message = `Запрос завершился с ошибкой ${response.status}.`;
  let code = "request_failed";
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object") {
      const item = body as ErrorShape;
      if (typeof item.message === "string") message = item.message;
      else if (typeof item.detail === "string") message = item.detail;
      else if (typeof item.error === "string") message = item.error;
      if (typeof item.code === "string") code = item.code;
    }
  } catch {
    // Тело не JSON — оставляем сообщение по статусу.
  }
  return new ApiError(message, code, response.status);
}
