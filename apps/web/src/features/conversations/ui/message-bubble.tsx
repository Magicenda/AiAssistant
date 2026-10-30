"use client";

import { useRef, useState } from "react";
import { Check, Copy, Pause, Play, RefreshCw, Reply, Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Logo } from "@/shared/ui/logo";
import { Markdown } from "@/shared/ui/markdown";
import { cn } from "@/shared/lib/cn";
import { formatDuration } from "@/shared/lib/format-duration";
import type { ChatAudio, ChatMessage } from "@/entities/chat";

const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const collapseAfterChars = 480;
const collapseAfterLines = 8;

/** Копирует в буфер с фолбэком на `execCommand` — для контекстов без Clipboard API. */
async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.className = "fixed opacity-0";
      area.setAttribute("readonly", "");
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

interface AssistantAvatarProps {
  /** Ассистент сейчас отвечает: включаем подсветку и бегущую строку развёртки. */
  busy?: boolean;
}

/**
 * Пиксельная аватарка ассистента: плашка-экранчик с ЭЛТ-развёрткой.
 * В спокойном состоянии развёртка статична, чтобы лента не рябила.
 *
 * @param props - Пропсы аватарки.
 * @returns Разметку аватарки с логотипом и сканлайнами.
 */
export function AssistantAvatar({ busy = false }: AssistantAvatarProps) {
  return (
    <span
      className={cn(
        "pixel-bevel bg-secondary text-secondary-foreground relative flex size-9 shrink-0 items-center justify-center",
        busy && "assistant-signal",
      )}
    >
      {/* Развёртка поверх плашки отсылает к ЭЛТ-экрану — общему мотиву сайта. */}
      <span className={cn("assistant-scan", busy && "assistant-scan--live")} />
      <Logo className="relative size-5" />
    </span>
  );
}

/** Плеер голосового сообщения ('use client': играет `<audio>` и показывает прогресс). */
export function VoiceBubble({ audio }: { audio: ChatAudio }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const progress = audio.duration > 0 ? Math.min(100, (time / audio.duration) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={playing ? "Пауза" : "Прослушать"}
        onClick={() => {
          const el = ref.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className="pixel-bevel bg-primary-foreground text-primary hover:text-primary size-9 shrink-0"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
      </Button>
      <div className="bg-primary-foreground/25 h-2 min-w-0 flex-1">
        <div className="bg-primary-foreground h-full" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-primary-foreground shrink-0 font-mono text-xs tabular-nums">
        {formatDuration(playing ? time : audio.duration)}
      </span>
      <audio
        ref={ref}
        src={audio.dataUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setTime(0);
        }}
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
      />
    </div>
  );
}

/** Иконочная кнопка действия над сообщением; `danger` включает тревожный цвет. */
function ActionButton({
  label,
  danger,
  onClick,
  children,
}: {
  label: string;
  danger?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      aria-label={label}
      title={label}
      className={cn("size-7", danger && "hover:text-destructive")}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export interface MessageBubbleProps {
  /** Сообщение локальной истории. */
  message: ChatMessage;
  /** Сообщение продолжает предыдущее того же автора за тот же день. */
  grouped?: boolean;
  /** Последнее в группе — у него показывается время. */
  lastInGroup?: boolean;
  /** Ответить цитатой на сообщение. */
  onReply?: (message: ChatMessage) => void;
  /** Удалить сообщение. */
  onDelete?: (message: ChatMessage) => void;
  /** Перегенерировать ответ ассистента. */
  onRegenerate?: (message: ChatMessage) => void;
  /** Ответ ещё стримится с backend: показываем курсор и «живую» аватарку. */
  streaming?: boolean;
}

/**
 * Пузырь сообщения ('use client': копирование, сворачивание длинных текстов).
 * Сообщения пользователя — справа, ответы ассистента — слева с аватаркой.
 *
 * @param props - Пропсы пузыря.
 * @returns Разметку сообщения с действиями и временем.
 */ export function MessageBubble({
  message,
  grouped = false,
  lastInGroup = true,
  onReply,
  onDelete,
  onRegenerate,
  streaming = false,
}: MessageBubbleProps) {
  const isUser = message.role !== "assistant";
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong =
    !message.audio &&
    (message.text.length > collapseAfterChars ||
      message.text.split("\n").length > collapseAfterLines);
  const collapsed = isLong && !expanded;

  async function copy() {
    if (!(await copyText(message.text || "Голосовое сообщение"))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const actions = (
    <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      <ActionButton label={copied ? "Скопировано" : "Копировать"} onClick={() => void copy()}>
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </ActionButton>
      {onReply && (
        <ActionButton label="Ответить" onClick={() => onReply(message)}>
          <Reply className="size-4" />
        </ActionButton>
      )}
      {!isUser && onRegenerate && (
        <ActionButton label="Перегенерировать" onClick={() => onRegenerate(message)}>
          <RefreshCw className="size-4" />
        </ActionButton>
      )}
      {onDelete && (
        <ActionButton label="Удалить сообщение" danger onClick={() => onDelete(message)}>
          <Trash2 className="size-4" />
        </ActionButton>
      )}
    </div>
  );

  const bubble = (
    <div
      className={cn(
        "pixel-frame w-fit max-w-full px-4 py-2.5",
        isUser ? "bg-primary text-primary-foreground" : "bg-card text-card-foreground",
      )}
    >
      {message.replyTo && (
        <div
          className={cn(
            "mb-2 border-l-2 py-0.5 pl-2",
            isUser ? "border-primary-foreground/50" : "border-primary",
          )}
        >
          <span
            className={cn(
              "font-pixel text-[0.65rem]",
              isUser ? "text-primary-foreground/80" : "text-primary",
            )}
          >
            {message.replyTo.role === "assistant" ? "Ассистент" : "Вы"}
          </span>
          <p
            className={cn(
              "line-clamp-2 text-xs [overflow-wrap:anywhere]",
              isUser ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {message.replyTo.text}
          </p>
        </div>
      )}

      {message.audio ? (
        <div className="space-y-2">
          <VoiceBubble audio={message.audio} />
          {message.text && (
            <div
              className={cn(
                "border-t pt-2",
                isUser ? "border-primary-foreground/30" : "border-border",
              )}
            >
              <Markdown text={message.text} tone={isUser ? "user" : "assistant"} />
            </div>
          )}
        </div>
      ) : (
        <>
          <div
            className={cn(
              collapsed &&
                "max-h-56 overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]",
            )}
          >
            <Markdown
              text={message.text}
              tone={isUser ? "user" : "assistant"}
              className={streaming ? "assistant-stream" : undefined}
            />
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(value => !value)}
              className={cn(
                "font-pixel mt-2 text-[0.7rem] underline-offset-4 hover:underline",
                isUser ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {expanded ? "Свернуть" : "Показать полностью"}
            </button>
          )}
        </>
      )}
    </div>
  );

  const meta = (
    <div className="flex items-center gap-1">
      {actions}
      {lastInGroup && message.createdAt ? (
        <span className="text-muted-foreground/80 font-mono text-[0.7rem] tracking-wider tabular-nums">
          {timeFormat.format(message.createdAt)}
        </span>
      ) : null}
    </div>
  );

  if (isUser) {
    return (
      <div className={cn("group flex flex-col items-end gap-1", grouped ? "mt-1" : "mt-3")}>
        <div className="flex w-fit max-w-[85%] flex-col items-end sm:max-w-[75%]">{bubble}</div>
        <div className="pr-1">{meta}</div>
      </div>
    );
  }

  return (
    <div className={cn("group mt-3 flex items-end gap-2.5", grouped && "mt-1")}>
      {lastInGroup ? (
        <AssistantAvatar busy={streaming} />
      ) : (
        <span className="size-9 shrink-0" aria-hidden="true" />
      )}
      <div className="flex max-w-[85%] min-w-0 flex-col items-start gap-1 sm:max-w-[75%]">
        {bubble}
        <div className="pl-1">{meta}</div>
      </div>
    </div>
  );
}

/** Индикатор «ассистент печатает»: прыгающие пиксели и подпись в духе терминала. */
export function TypingBubble() {
  return (
    <div className="mt-3 flex items-end gap-2.5" role="status" aria-live="polite">
      <AssistantAvatar busy />
      <div className="pixel-frame bg-card relative flex items-center gap-2.5 overflow-hidden px-3 py-2.5">
        <span className="assistant-scan assistant-scan--live" />
        <span className="relative flex items-end gap-1">
          <span className="assistant-typing bg-secondary size-2" />
          <span className="assistant-typing bg-secondary size-2 [animation-delay:180ms]" />
          <span className="assistant-typing bg-secondary size-2 [animation-delay:360ms]" />
        </span>
        <span className="font-pixel text-muted-foreground relative text-[0.6rem] tracking-[0.15em]">
          печатает
        </span>
      </div>
      <span className="sr-only">Ассистент печатает…</span>
    </div>
  );
}
