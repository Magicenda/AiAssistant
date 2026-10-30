export type ProviderId = "gigachat" | "local";

/** Пресет провайдера для быстрого выбора в форме настроек. */
export interface ProviderPreset {
  id: ProviderId;
  /** Название в интерфейсе. */
  label: string;
  /** Базовый адрес API без `/chat/completions`; пустой для GigaChat. */
  baseUrl: string;
  /** Модель по умолчанию; пустая, если её задаёт сервер. */
  model: string;
  /** Пояснение для пользователя под селектом. */
  note: string;
}

/** Доступные варианты; GigaChat — по умолчанию, локальная модель — альтернатива. */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "gigachat",
    label: "GigaChat",
    baseUrl: "",
    model: "",
    note: "Модель проекта по умолчанию. Ключ и модель заданы на сервере.",
  },
  {
    id: "local",
    label: "Локальная модель",
    baseUrl: "http://localhost:11434/v1",
    model: "",
    note: "Ollama или LM Studio: укажите адрес и модель из локального сервера.",
  },
];

/** Настройки модели, хранящиеся в localStorage браузера. */
export interface ModelSettings {
  /** Выбранный провайдер. */
  provider: ProviderId;
  /** Базовый адрес API без `/chat/completions`; пустой для GigaChat. */
  baseUrl: string;
  /** Ключ локального сервера; обычно не требуется. */
  apiKey: string;
  /** Идентификатор локальной модели. */
  model: string;
  /** От 0 до 1.5. */
  temperature: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  provider: "gigachat",
  baseUrl: "",
  apiKey: "",
  model: "",
  temperature: 0.7,
};

/** Настройки, которые фронтенд передаёт backend для локальной модели. */
export interface ModelRequestSettings {
  provider: "local";
  /** Копия `baseUrl` — контракт backend в snake_case. */
  base_url: string;
  /** Копия `apiKey`. */
  api_key: string;
  model: string;
  temperature: number;
}

/** Локальная модель — всё, что не GigaChat; пустой адрес означает GigaChat. */
export function providerFor(baseUrl: string): ProviderId {
  return baseUrl.trim() ? "local" : "gigachat";
}

/** Локальный адрес: ключ для него не нужен. */
export function isLocalAddress(value: string) {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)(:|\/|$)/i.test(
      value.trim(),
    ) || /\.local(?::|\/|$)/i.test(value.trim())
  );
}
