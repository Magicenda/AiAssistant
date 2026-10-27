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
    } catch { return false; }
  }
}

export function AssistantAvatar() {
  return (
    <span className="pixel-bevel flex size-9 shrink-0 items-center justify-center bg-secondary text-secondary-foreground">
      <Logo className="size-5" />
    </span>
  );
}

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
        className="pixel-bevel size-9 shrink-0 bg-primary-foreground text-primary hover:text-primary"
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 fill-current" />}
      </Button>
      <div className="h-2 min-w-0 flex-1 bg-primary-foreground/25">
        <div className="h-full bg-primary-foreground" style={{ width: `${progress}%` }} />
      </div>
      <span className="shrink-0 font-mono text-xs tabular-nums text-primary-foreground">
        {formatDuration(playing ? time : audio.duration)}
      </span>
      <audio
        ref={ref}
        src={audio.dataUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); }}
        onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
      />
    </div>
  );
}

function ActionButton({ label, danger, onClick, children }: {
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
  message: ChatMessage;
  grouped?: boolean;
  lastInGroup?: boolean;
  onReply?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onRegenerate?: (message: ChatMessage) => void;
}

export function MessageBubble({
  message,
  grouped = false,
  lastInGroup = true,
  onReply,
  onDelete,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role !== "assistant";
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = !message.audio && (
    message.text.length > collapseAfterChars ||
    message.text.split("\n").length > collapseAfterLines
  );
  const collapsed = isLong && !expanded;

  async function copy() {
    if (!await copyText(message.text || "Голосовое сообщение")) return;
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
            <Markdown text={message.text} tone={isUser ? "user" : "assistant"} />
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(value => !value)}
              className={cn(
                "mt-2 font-pixel text-[0.7rem] underline-offset-4 hover:underline",
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
        <span className="font-mono text-[0.7rem] tabular-nums tracking-wider text-muted-foreground/80">
          {timeFormat.format(message.createdAt)}
        </span>
      ) : null}
    </div>
  );

  if (isUser) {
    return (
      <div className={cn("group flex flex-col items-end gap-1", grouped ? "mt-1" : "mt-3")}>
        <div className="flex w-fit max-w-[85%] flex-col items-end sm:max-w-[75%]">
          {bubble}
        </div>
        <div className="pr-1">{meta}</div>
      </div>
    );
  }

  return (
    <div className={cn("group mt-3 flex items-end gap-2.5", grouped && "mt-1")}>
      {lastInGroup ? <AssistantAvatar /> : <span className="size-9 shrink-0" aria-hidden="true" />}
      <div className="flex min-w-0 max-w-[85%] flex-col items-start gap-1 sm:max-w-[75%]">
        {bubble}
        <div className="pl-1">{meta}</div>
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="mt-3 flex items-end gap-2.5" role="status" aria-live="polite">
      <AssistantAvatar />
      <div className="pixel-frame flex items-center gap-1.5 bg-card px-4 py-3">
        <span className="pixel-blink size-2 bg-secondary" />
        <span className="pixel-blink size-2 bg-secondary [animation-delay:150ms]" />
        <span className="pixel-blink size-2 bg-secondary [animation-delay:300ms]" />
      </div>
      <span className="sr-only">Ассистент печатает…</span>
    </div>
  );
}
