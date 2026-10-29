/**
 * Адрес backend API задаётся только через окружение: NEXT_PUBLIC_API_URL.
 * Значение инлайнится на этапе сборки и не меняется в интерфейсе.
 */
function safeEnv(value: string | undefined) {
  const fallback = "http://localhost:8000";
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

const envUrl = safeEnv(process.env.NEXT_PUBLIC_API_URL);

/** Возвращает адрес backend API, зашитый на этапе сборки. */
export function getApiUrl() {
  return envUrl;
}
