import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_VOICE_SETTINGS, readVoiceSettings, writeVoiceSettings } from "./settings";

const storage = new Map<string, string>();

function summarize() {
  return {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value),
    removeItem: (key: string) => void storage.delete(key),
  };
}

describe("voice settings", () => {
  beforeEach(() => {
    storage.clear();
    // Настройки живут в localStorage; в node-окружении подменяем браузерные API.
    vi.stubGlobal("localStorage", summarize());
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("по умолчанию озвучивает браузер", () => {
    expect(readVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
    expect(readVoiceSettings().engine).toBe("browser");
  });

  it("умеет переключаться на серверный движок", () => {
    writeVoiceSettings({ engine: "server" });
    expect(readVoiceSettings().engine).toBe("server");
    expect(storage.get("assistant-voice-settings-v1")).toContain('"engine":"server"');
  });

  it("подставляет значение по умолчанию для некорректных данных", () => {
    writeVoiceSettings({ engine: "unknown" });
    expect(readVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
    writeVoiceSettings("нет");
    expect(readVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS);
  });

  it("игнорирует устаревшую настройку автозапуска озвучки", () => {
    writeVoiceSettings({ engine: "server", speakReplies: false });
    expect(readVoiceSettings()).toEqual({ engine: "server" });
  });
});
