import { describe, expect, it } from "vitest";
import { ApiError, readError } from "./errors";

describe("ApiError", () => {
  it("prefers the server detail string", () => {
    const error = new ApiError(409, "Такой пользователь уже существует");
    expect(error.message).toBe("Такой пользователь уже существует");
    expect(error.status).toBe(409);
    expect(error.kind).toBe("http");
  });

  it("formats 422 validation arrays", () => {
    const error = new ApiError(422, [
      { loc: ["body", "username"], msg: "too short", type: "string_too_short" },
    ]);
    expect(error.message).toBe("username: too short");
  });

  it("falls back to the status message when detail is null", () => {
    expect(new ApiError(404, null).message).toBe("Не найдено или недоступно");
    expect(new ApiError(413, null).message).toBe("Файл слишком большой (максимум 25 МБ)");
    expect(new ApiError(401, null).message).toBe(
      "Требуется вход. Пожалуйста, авторизуйтесь снова.",
    );
  });

  it("uses a generic fallback for unknown statuses", () => {
    expect(new ApiError(418, null).message).toBe("Запрос завершился с ошибкой");
  });

  it("has fixed messages for transport errors", () => {
    expect(new ApiError(0, "ignored", "network").message).toBe(
      "Сервис недоступен. Проверьте подключение.",
    );
    expect(new ApiError(0, "ignored", "timeout").message).toBe(
      "Превышено время ожидания ответа от сервера",
    );
  });
});

describe("readError", () => {
  it("extracts detail from a JSON error body", async () => {
    const res = new Response(JSON.stringify({ detail: "Чат не найден" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
    const error = await readError(res);
    expect(error.status).toBe(404);
    expect(error.detail).toBe("Чат не найден");
    expect(error.message).toBe("Чат не найден");
  });

  it("tolerates non-JSON error bodies", async () => {
    const res = new Response("oops", { status: 500 });
    const error = await readError(res);
    expect(error.status).toBe(500);
    expect(error.detail).toBeNull();
    expect(error.message).toBe("Ошибка сервера");
  });
});
