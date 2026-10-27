export type ProviderId = "openrouter" | "openai" | "deepseek" | "mistral" | "ollama" | "custom";

export interface ProviderPreset {
  id: ProviderId;
  label: string;
  baseUrl: string;
  model: string;
  keyRequired: boolean;
  note: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    keyRequired: true,
    note: "Сотни моделей от разных провайдеров по одному ключу.",
  },
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    keyRequired: true,
    note: "Модели GPT и распознавание речи Whisper.",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    keyRequired: true,
    note: "Недорогие модели DeepSeek с OpenAI-совместимым API.",
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    model: "mistral-small-latest",
    keyRequired: true,
    note: "Европейский провайдер с OpenAI-совместимым API.",
  },
  {
    id: "ollama",
    label: "Ollama",
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
    keyRequired: false,
    note: "Локальная модель без ключа и без интернета.",
  },
  {
    id: "custom",
    label: "Другой",
    baseUrl: "",
    model: "",
    keyRequired: true,
    note: "Любой сервис с OpenAI-совместимым /chat/completions.",
  },
];

export interface ModelSettings {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "",
  model: "",
  temperature: 0.7,
};

/** Настройки, которые фронтенд передаёт backend вместе с запросом. */
export interface ModelRequestSettings {
  provider: ProviderId;
  base_url: string;
  api_key: string;
  model: string;
  temperature: number;
}

export function providerFor(baseUrl: string): ProviderId {
  return PROVIDER_PRESETS.find(preset => preset.baseUrl === baseUrl)?.id ?? "custom";
}

export function isLocalAddress(value: string) {
  return (
    /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal)(:|\/|$)/i.test(
      value.trim(),
    ) || /\.local(?::|\/|$)/i.test(value.trim())
  );
}

export function requiresApiKey(baseUrl: string) {
  return !isLocalAddress(baseUrl);
}
