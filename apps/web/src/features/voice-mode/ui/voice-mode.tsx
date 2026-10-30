"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { MessageSquare, Play, RotateCcw, Square } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";
import { formatDuration } from "@/shared/lib/format-duration";
import { plainText } from "@/shared/lib/plain-text";
import { useVoiceSession, type VoicePhase } from "../model/use-voice-session";
import { VoiceBars, VoiceScreen } from "./voice-screen";

const copy: Record<VoicePhase | "listening", { title: string; hint: string }> = {
  idle: {
    title: "Нажмите на ассистента",
    hint: "Скажите задачу — ассистент ответит голосом.",
  },
  listening: {
    title: "Слушаю…",
    hint: "Пауза в речи отправит запись автоматически.",
  },
  transcribing: {
    title: "Распознаю речь…",
    hint: "Проверяю, что вы сказали.",
  },
  thinking: {
    title: "Думаю над ответом…",
    hint: "Нажмите на ассистента, чтобы отменить.",
  },
  speaking: {
    title: "Отвечаю голосом…",
    hint: "Нажмите на ассистента, чтобы перебить.",
  },
  error: {
    title: "Не получилось",
    hint: "Нажмите на ассистента, чтобы попробовать снова.",
  },
};

interface VoiceModeProps {
  /** Существующий чат для продолжения; без него диалог начнётся с первой фразы. */
  chatId?: string;
}

/**
 * Голосовой режим ('use client': микрофон, автослушивание и анимированный пиксельный ассистент).
 *
 * @param props - id чата, если режим открыт из текстового диалога.
 * @returns Экран голосового общения с историей реплик.
 */
export function VoiceMode({ chatId }: VoiceModeProps) {
  const session = useVoiceSession(chatId);
  const transcript = useRef<HTMLDivElement>(null);
  const phase = session.displayPhase;
  const status = copy[phase];

  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [session.turns.length]);

  const assistantLabel =
    phase === "listening"
      ? "Отправить запись"
      : phase === "speaking"
        ? "Перебить ответ"
        : phase === "transcribing" || phase === "thinking"
          ? "Отменить ответ"
          : "Начать говорить";

  const lastTurn = session.turns.at(-1);

  return (
    <section className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-5xl flex-col lg:h-[calc(100dvh-2rem)]">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <div className="min-w-0">
          <p className="text-primary font-mono text-[0.65rem] tracking-[0.2em] uppercase">
            Голосовой режим
          </p>
          <h1 className="font-pixel text-foreground truncate text-lg sm:text-xl">
            {session.chatId ? "Диалог голосом" : "Новый голосовой диалог"}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={session.autoListen}
            aria-label="Автоматически слушать после ответа"
            title="Автоматически слушать после ответа"
            onClick={session.toggleAutoListen}
            className="border-border text-muted-foreground hover:text-foreground flex items-center gap-2 border-2 px-2 py-1.5 font-mono text-[0.65rem] tracking-wider uppercase"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-4 w-7 items-center p-0.5 transition-colors",
                session.autoListen ? "bg-primary" : "bg-input",
              )}
            >
              <span
                className={cn(
                  "size-2.5 transition-transform",
                  session.autoListen
                    ? "bg-primary-foreground translate-x-3"
                    : "bg-muted-foreground translate-x-0",
                )}
              />
            </span>
            Автослушать
          </button>
          <Button asChild variant="outline" size="sm">
            <Link href={session.chatId ? `/chat/${session.chatId}` : "/chat"}>
              <MessageSquare className="size-4" />В чат
            </Link>
          </Button>
          {session.chatId && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/voice">
                <RotateCcw className="size-4" />
                Новый
              </Link>
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <VoiceScreen
            phase={phase}
            level={session.level}
            label={assistantLabel}
            onClick={session.toggle}
          />

          <div className="text-center" role="status" aria-live="polite">
            <p className="font-pixel text-foreground text-base sm:text-lg">{status.title}</p>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm px-4 font-mono text-xs leading-relaxed">
              {phase === "listening"
                ? `${formatDuration(session.elapsed)} · ${status.hint}`
                : status.hint}
            </p>
          </div>

          <VoiceBars phase={phase} />

          {lastTurn && (
            <div className="pixel-panel w-full max-w-sm px-3 py-2 md:hidden">
              <p className="font-pixel text-muted-foreground text-[0.6rem]">
                {lastTurn.role === "user" ? "Вы" : "Ассистент"}
              </p>
              <p className="text-foreground mt-0.5 line-clamp-3 font-mono text-xs leading-relaxed">
                {plainText(lastTurn.text)}
              </p>
            </div>
          )}

          {session.error && (
            <p
              role="alert"
              className="text-destructive max-w-sm px-4 text-center font-mono text-xs"
            >
              {session.error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {session.hasAudio && phase !== "speaking" && (
              <Button type="button" variant="ghost" size="sm" onClick={session.replay}>
                <Play className="size-4" />
                Повторить
              </Button>
            )}
            {(phase === "listening" || phase === "speaking") && (
              <Button type="button" variant="outline" size="sm" onClick={session.toggle}>
                <Square className="size-4" />
                {phase === "listening" ? "Отправить" : "Перебить"}
              </Button>
            )}
          </div>
        </div>

        <aside className="pixel-panel hidden shrink-0 flex-col p-3 md:flex md:w-72 xl:w-80">
          <div className="flex items-center justify-between">
            <p className="font-pixel text-foreground text-xs">Диалог</p>
            <span className="text-muted-foreground font-mono text-[0.65rem]">
              {session.turns.length} реплик
            </span>
          </div>

          <div
            ref={transcript}
            role="log"
            aria-live="polite"
            className="pixel-scrollbar mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
          >
            {session.loading ? (
              <p className="text-muted-foreground p-2 font-mono text-xs">Загрузка истории…</p>
            ) : session.turns.length === 0 ? (
              <p className="text-muted-foreground p-2 font-mono text-xs leading-relaxed">
                Скажите что-нибудь — расшифровка и ответ появятся здесь.
              </p>
            ) : (
              session.turns.map(turn => (
                <div
                  key={turn.id}
                  className={cn(
                    "pixel-frame px-2 py-1.5",
                    turn.role === "user" ? "bg-primary/10" : "bg-card",
                  )}
                >
                  <p className="font-pixel text-muted-foreground text-[0.6rem]">
                    {turn.role === "user" ? "Вы" : "Ассистент"}
                  </p>
                  <p className="text-foreground mt-0.5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {plainText(turn.text)}
                  </p>
                </div>
              ))
            )}
          </div>

          {session.chatId && (
            <Link
              href={`/chat/${session.chatId}`}
              className="text-primary mt-2 shrink-0 font-mono text-[0.65rem] tracking-wider uppercase underline underline-offset-4"
            >
              Продолжить текстом
            </Link>
          )}
        </aside>
      </div>
    </section>
  );
}
