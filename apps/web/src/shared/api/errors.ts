import { formatDetail } from "@/shared/lib/detail";

export type ApiErrorKind = "http" | "network" | "timeout";

const STATUS_MESSAGES: Record<number, string> = {
  400: "Некорректный запрос",
  401: "Требуется вход. Пожалуйста, авторизуйтесь снова.",
  404: "Не найдено или недоступно",
  409: "Такой пользователь уже существует",
  413: "Файл слишком большой (максимум 25 МБ)",
  422: "Проверьте правильность заполнения полей",
  429: "Слишком много запросов. Попробуйте позже.",
  500: "Ошибка сервера",
  502: "Сервис временно недоступен",
  503: "Сервис временно недоступен",
};

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly detail: unknown;
  constructor(status: number, detail: unknown, kind: ApiErrorKind = "http") {
    super(ApiError.toMessage(status, detail, kind));
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
    this.detail = detail;
  }

  private static toMessage(status: number, detail: unknown, kind: ApiErrorKind): string {
    if (kind === "timeout") return "Превышено время ожидания ответа от сервера";
    if (kind === "network") return "Сервис недоступен. Проверьте подключение.";
    return formatDetail(detail) ?? STATUS_MESSAGES[status] ?? "Запрос завершился с ошибкой";
  }
}

export async function readError(res: Response): Promise<ApiError> {
  let detail: unknown = null;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      detail = (body as Record<string, unknown>).detail ?? null;
    }
  } catch {
    detail = null;
  }
  return new ApiError(res.status, detail);
}
