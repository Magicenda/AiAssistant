import {
  DEFAULT_MODEL_SETTINGS,
  type ModelRequestSettings,
  type ModelSettings,
  type ProviderId,
} from "./types";

const storageKey = "assistant-model-settings-v1";
const event = "model-settings-change";

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("protocol");
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    throw new Error(
      "Адрес API модели должен быть полной ссылкой, например https://api.openai.com/v1",
    );
  }
}

function normalizeProvider(value: unknown): ProviderId {
  return value === "openrouter" ||
    value === "openai" ||
    value === "deepseek" ||
    value === "mistral" ||
    value === "ollama" ||
    value === "custom"
    ? value
    : DEFAULT_MODEL_SETTINGS.provider;
}

function normalizeTemperature(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_MODEL_SETTINGS.temperature;
  return Math.min(1.5, Math.max(0, Math.round(number * 100) / 100));
}

function normalizeSettings(value: unknown): ModelSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_MODEL_SETTINGS };
  const item = value as Record<string, unknown>;
  return {
    provider: normalizeProvider(item.provider),
    baseUrl: normalizeBaseUrl(typeof item.baseUrl === "string" ? item.baseUrl : ""),
    apiKey: typeof item.apiKey === "string" ? item.apiKey.trim() : "",
    model: typeof item.model === "string" ? item.model.trim() : "",
    temperature: normalizeTemperature(item.temperature),
  };
}

let cached: ModelSettings | null = null;

function loadFromStorage(): ModelSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_MODEL_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_MODEL_SETTINGS };
  }
}

function current(): ModelSettings {
  if (!cached) cached = loadFromStorage();
  return cached;
}

/** Настройки из localStorage; на сервере и при ошибке — значения по умолчанию. */
export function readModelSettings(): ModelSettings {
  if (typeof window === "undefined") return { ...DEFAULT_MODEL_SETTINGS };
  return current();
}

/** Валидирует и сохраняет настройки, уведомляет подписчиков. */
export function writeModelSettings(value: unknown): ModelSettings {
  const settings = normalizeSettings(value);
  localStorage.setItem(storageKey, JSON.stringify(settings));
  cached = settings;
  window.dispatchEvent(new Event(event));
  return settings;
}

/** Удаляет сохранённые настройки и возвращает значения по умолчанию. */
export function resetModelSettings(): ModelSettings {
  localStorage.removeItem(storageKey);
  cached = { ...DEFAULT_MODEL_SETTINGS };
  window.dispatchEvent(new Event(event));
  return { ...DEFAULT_MODEL_SETTINGS };
}

/** Подписка на изменения настроек; возвращает функцию отписки. */
export function subscribeModelSettings(listener: () => void) {
  const wrapped = () => {
    cached = null;
    listener();
  };
  window.addEventListener(event, wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener(event, wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

/**
 * Возвращает настройки модели для запроса к backend или null, если модель
 * не заполнена: тогда backend использует свою конфигурацию по умолчанию.
 */
export function modelRequestSettings(): ModelRequestSettings | null {
  const settings = readModelSettings();
  if (!settings.baseUrl || !settings.model) return null;
  return {
    provider: settings.provider,
    base_url: settings.baseUrl,
    api_key: settings.apiKey,
    model: settings.model,
    temperature: settings.temperature,
  };
}
