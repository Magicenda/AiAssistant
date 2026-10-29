import { clearAccessToken } from "@/shared/api";

/** Выход из аккаунта: удаляет сохранённый JWT (refresh-токенов в API нет). */
export function logout(): void {
  clearAccessToken();
}
