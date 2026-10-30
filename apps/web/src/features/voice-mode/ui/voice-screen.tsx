import type { CSSProperties } from "react";

import { cn } from "@/shared/lib/cn";
import type { VoicePhase } from "../model/use-voice-session";

interface VoiceScreenProps {
  /** Текущая фаза: от неё зависит, что делает ассистент на экране. */
  phase: VoicePhase | "listening";
  /** Громкость микрофона 0–1: двигает рот-эквалайзер. */
  level: number;
  /** Подпись для скринридера и подсказки. */
  label: string;
  /** Нажатие на ассистента: начать, отправить, перебить или отменить. */
  onClick: () => void;
}

/**
 * Пиксельный ассистент голосового режима ('use client' через родителя).
 * Вместо гладкой сферы — спрайт из прямоугольников на экранчике: он моргает,
 * открывает рот под громкость речи и показывает ошибку крестиками.
 *
 * @param props - Фаза, громкость, подпись и обработчик нажатия.
 * @returns Кнопку-экран с пиксельным ассистентом.
 */
export function VoiceScreen({ phase, level, label, onClick }: VoiceScreenProps) {
  // Громкость квантуем в шесть ступеней: рот двигается рывками, как в 8-битной игре.
  const volume = Math.round(Math.min(1, Math.max(0, level)) * 6) / 6;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-phase={phase}
      className="voice-screen pixel-bevel"
    >
      <svg
        viewBox="2 0 28 24"
        shapeRendering="crispEdges"
        aria-hidden="true"
        className="voice-screen__sprite"
      >
        {/* Антенна: лампочка сигналит, что ассистент работает. */}
        <g className="voice-screen__antenna">
          <rect x="15" y="2" width="2" height="2" />
          <rect className="voice-screen__led" x="13" y="0" width="6" height="2" />
        </g>

        {/* Голова: плашка в цветах темы, вокруг неё — «наушники» по бокам. */}
        <g className="voice-screen__head">
          <rect x="9" y="4" width="14" height="2" />
          <rect x="6" y="6" width="20" height="14" />
          <rect x="8" y="20" width="16" height="2" />
          <rect x="11" y="22" width="10" height="1" />
          <rect x="3" y="10" width="2" height="8" />
          <rect x="27" y="10" width="2" height="8" />
        </g>

        {/* Экран лица: тёмное поле, на котором светятся глаза и рот. */}
        <rect className="voice-screen__face" x="8" y="8" width="16" height="10" />

        <g className="voice-screen__eyes">
          <rect x="12" y="10" width="2" height="2" />
          <rect x="18" y="10" width="2" height="2" />
        </g>

        {/* Крестики вместо глаз: ответ не удался. */}
        <g className="voice-screen__eyes-error">
          <rect x="12" y="10" width="1" height="1" />
          <rect x="14" y="10" width="1" height="1" />
          <rect x="13" y="11" width="1" height="1" />
          <rect x="12" y="12" width="1" height="1" />
          <rect x="14" y="12" width="1" height="1" />
          <rect x="18" y="10" width="1" height="1" />
          <rect x="20" y="10" width="1" height="1" />
          <rect x="19" y="11" width="1" height="1" />
          <rect x="18" y="12" width="1" height="1" />
          <rect x="20" y="12" width="1" height="1" />
        </g>

        {/* Рот — пять столбиков эквалайзера, как у голосового индикатора. */}
        <g className="voice-screen__mouth" style={{ "--voice-level": volume } as CSSProperties}>
          <rect className="voice-screen__bar" x="9" y="16" width="2" height="1" />
          <rect className="voice-screen__bar" x="12" y="15" width="2" height="2" />
          <rect className="voice-screen__bar" x="15" y="14" width="2" height="3" />
          <rect className="voice-screen__bar" x="18" y="15" width="2" height="2" />
          <rect className="voice-screen__bar" x="21" y="16" width="2" height="1" />
        </g>
      </svg>

      {/* Сканлайны поверх картинки: экран остаётся ЭЛТ-монитором. */}
      <span aria-hidden="true" className="voice-screen__scan" />
    </button>
  );
}

/** Полоски-эквалайзер: оживают, когда ассистент слушает или говорит. */
export function VoiceBars({ phase }: { phase: VoicePhase | "listening" }) {
  const live = phase === "listening" || phase === "speaking";
  const speaking = phase === "speaking";

  return (
    <div className="flex h-8 items-end gap-1.5" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span
          key={index}
          className={cn(
            "voice-bar w-1.5",
            live && "voice-bar--live",
            speaking && "voice-bar--speaking",
          )}
          style={live ? { animationDelay: `${index * 80}ms` } : undefined}
        />
      ))}
    </div>
  );
}
