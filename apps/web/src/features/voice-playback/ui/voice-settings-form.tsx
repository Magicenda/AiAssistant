"use client";

import { useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";

import {
  DEFAULT_VOICE_SETTINGS,
  readVoiceSettings,
  subscribeVoiceSettings,
  writeVoiceSettings,
  type VoiceEngine,
} from "@/entities/voice";

const selectClass =
  "h-10 w-full border-2 border-border bg-input px-3 font-mono text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Настройка движка озвучки ('use client': настройки пишутся в localStorage).
 *
 * @returns Секцию настроек с выбором движка для голосового режима.
 */
export function VoiceSettingsForm() {
  const settings = useSyncExternalStore(
    subscribeVoiceSettings,
    readVoiceSettings,
    () => DEFAULT_VOICE_SETTINGS,
  );

  function changeEngine(engine: VoiceEngine) {
    writeVoiceSettings({ engine });
  }

  return (
    <section className="pixel-panel space-y-4 p-5">
      <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
        <Volume2 className="text-primary size-4" />
        Голос
      </h2>

      <label className="text-muted-foreground block space-y-2 font-mono text-xs tracking-wider uppercase">
        Движок озвучки
        <select
          className={selectClass}
          value={settings.engine}
          onChange={event => changeEngine(event.target.value as VoiceEngine)}
        >
          <option value="browser">Браузер — мгновенно</option>
          <option value="server">Сервер — красивее, но с задержкой</option>
        </select>
      </label>

      <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
        {settings.engine === "browser"
          ? "Используется голос системы: звук начинается практически сразу, без запроса к серверу."
          : "Сервер синтезирует голос Edge TTS: звучание стабильнее, но первый звук приходит с задержкой."}{" "}
        Озвучка работает только в голосовом режиме — текстовый чат отвечает без звука.
      </p>
    </section>
  );
}
