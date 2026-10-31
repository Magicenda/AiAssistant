import type { VoiceSettings } from "./types";

const storageKey = "assistant-voice-settings-v1";
const event = "voice-settings-change";

/** Значения по умолчанию: озвучивает браузер — это мгновенно. */
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  engine: "browser",
};

function normalizeSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_VOICE_SETTINGS };
  const item = value as Record<string, unknown>;
  return {
    engine: item.engine === "server" ? "server" : DEFAULT_VOICE_SETTINGS.engine,
  };
}

let cached: VoiceSettings | null = null;

function loadFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS };
  }
}

function current(): VoiceSettings {
  if (!cached) cached = loadFromStorage();
  return cached;
}

/** Настройки озвучки из localStorage; на сервере — значения по умолчанию. */
export function readVoiceSettings(): VoiceSettings {
  if (typeof window === "undefined") return { ...DEFAULT_VOICE_SETTINGS };
  return current();
}

/** Сохраняет настройки озвучки и уведомляет подписчиков. */
export function writeVoiceSettings(value: unknown): VoiceSettings {
  const settings = normalizeSettings(value);
  localStorage.setItem(storageKey, JSON.stringify(settings));
  cached = settings;
  window.dispatchEvent(new Event(event));
  return settings;
}

/** Подписка на изменения настроек озвучки; возвращает функцию отписки. */
export function subscribeVoiceSettings(listener: () => void) {
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
