"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AudioLines, ArrowUp, Clock, Mic, Pause, Play, Plus, Square } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { PixelSun } from "@/shared/ui/pixel-sun";
import { cn } from "@/shared/lib/cn";
import { useAudioRecording, type VoiceClip } from "../model/use-audio-recording";
import { readChats, writeChats } from "../model/store";
import type { Chat, ChatAudio, ChatMessage } from "@/entities/chat";

function formatSeconds(value: number) {
  const total = Math.max(0, Math.floor(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function AssistantAvatar() {
  return (
    <span className="pixel-bevel flex size-9 shrink-0 items-center justify-center bg-secondary text-secondary-foreground">
      <PixelSun className="size-5" />
    </span>
  );
}

function VoiceBubble({ audio }: { audio: ChatAudio }) {
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
        {formatSeconds(playing ? time : audio.duration)}
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

function ChatHistory({ chats, currentId, onNew, onClose }: {
  chats: Chat[];
  currentId?: string;
  onNew: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button type="button" aria-label="Закрыть историю"
        className="fixed inset-0 z-10 cursor-default" onClick={onClose} />
      <div className="pixel-panel absolute right-0 top-full z-20 mt-2 w-72">
        <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
          <span className="font-pixel text-xs text-foreground">История</span>
          <Button variant="ghost" size="sm" onClick={onNew}>
            <Plus className="size-4" />Новый
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {chats.length === 0 && (
            <p className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">Пока нет диалогов</p>
          )}
          {chats.map(chat => (
            <Link
              key={chat.id}
              href={`/chat/${chat.id}`}
              onClick={onClose}
              aria-current={chat.id === currentId ? "page" : undefined}
              className={cn(
                "flex flex-col gap-0.5 px-3 py-2 hover:bg-white/5",
                chat.id === currentId && "bg-white/5",
              )}
            >
              <span className="truncate font-pixel text-xs text-foreground">{chat.title || "Новый чат"}</span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {(() => {
                  const last = chat.messages.at(-1);
                  if (!last) return "Пока нет сообщений";
                  if (last.audio) return "Голосовое сообщение";
                  return last.text;
                })()}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

export function Conversation({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const audio = useAudioRecording();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setChats(readChats());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync();
    window.addEventListener("chats-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("chats-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const chat = sessionId ? chats.find(item => item.id === sessionId) ?? null : null;
  const messages = chat?.messages ?? [];
  const hasMessages = messages.length > 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  function persist(next: Chat) {
    try {
      const all = [next, ...chats.filter(item => item.id !== next.id)];
      writeChats(all);
      setChats(all);
      setError("");
      return next;
    } catch {
      setError("Не удалось сохранить сообщение. Хранилище браузера недоступно.");
      return null;
    }
  }

  function appendText(value: string) {
    const current: Chat = chat ?? { id: sessionId ?? crypto.randomUUID(), title: "", messages: [] };
    const message: ChatMessage = { id: crypto.randomUUID(), text: value, role: "user" };
    const next: Chat = {
      ...current,
      title: current.messages.length ? current.title : value.slice(0, 24),
      messages: [...current.messages, message],
    };
    const saved = persist(next);
    if (saved && !sessionId) router.push(`/chat/${next.id}`);
    return Boolean(saved);
  }

  function appendVoice(clip: VoiceClip) {
    const current: Chat = chat ?? { id: sessionId ?? crypto.randomUUID(), title: "", messages: [] };
    const message: ChatMessage = { id: crypto.randomUUID(), text: "", role: "user", audio: clip };
    const next: Chat = {
      ...current,
      title: current.messages.length ? current.title : "Голос",
      messages: [...current.messages, message],
    };
    const saved = persist(next);
    if (saved && !sessionId) router.push(`/chat/${next.id}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (appendText(value)) setText("");
  }

  async function handleStop() {
    const clip = await audio.stop();
    if (clip) appendVoice(clip);
  }

  function newChat() {
    setHistoryOpen(false);
    router.push("/chat");
  }

  const recording = audio.status === "recording";
  const busy = audio.status === "starting" || audio.status === "stopping";

  return (
    <section className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-3xl flex-col lg:h-[calc(100dvh-2rem)]">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <AssistantAvatar />
          <div className="min-w-0">
            <p className="truncate font-pixel text-sm text-foreground">{chat?.title || "Ассистент"}</p>
            <p className="mt-1 truncate font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {hasMessages ? `${messages.length} сообщений` : "Новый диалог"}
            </p>
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="История чатов"
            onClick={() => setHistoryOpen(open => !open)}>
            <Clock className="size-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={newChat}>
            <Plus className="size-4" />Новый
          </Button>
          {historyOpen && (
            <ChatHistory chats={chats} currentId={sessionId}
              onNew={newChat} onClose={() => setHistoryOpen(false)} />
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pb-4">
        {!hasMessages && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <PixelSun className="mb-8 size-16 text-primary" />
            <h2 className="font-pixel text-2xl text-foreground">Чем помочь?</h2>
            <p className="mt-4 max-w-sm font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Напишите или надиктуйте задачу, встречу или напоминание.
            </p>
          </div>
        )}
        {messages.map(message => {
          const isUser = message.role !== "assistant";
          return (
            <div key={message.id} className={cn("flex items-end gap-3", isUser ? "justify-end" : "justify-start")}>
              {!isUser && <AssistantAvatar />}
              <div className={cn(
                "pixel-frame max-w-[75%] px-4 py-3 text-sm",
                isUser ? "bg-primary text-primary-foreground"
                  : "bg-card text-card-foreground",
              )}>
                {message.audio
                  ? <VoiceBubble audio={message.audio} />
                  : <p className="whitespace-pre-wrap break-words">{message.text}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3">
        {(error || audio.error) && (
          <p role="alert" className="mb-2 px-2 font-mono text-xs text-destructive">{error || audio.error}</p>
        )}
        <div className="pixel-panel p-2">
          {recording || busy ? (
            <div className="flex items-center gap-3 px-2 py-1">
              <span className={cn("size-3 shrink-0 bg-secondary", recording ? "pixel-blink" : "opacity-50")} />
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {formatSeconds(audio.elapsed)}
              </span>
              <AudioLines className="size-5 text-secondary" />
              <span className="ml-auto font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {audio.status === "starting" ? "Включаю микрофон…"
                  : audio.status === "stopping" ? "Сохраняю…" : "Говорите"}
              </span>
              <Button type="button" size="icon" variant="secondary" aria-label="Остановить запись"
                disabled={busy} onClick={() => void handleStop()}>
                <Square className="size-4" />
              </Button>
            </div>
          ) : (
            <form className="flex items-center gap-2" onSubmit={handleSubmit}>
              <Input aria-label="Сообщение" placeholder="Напишите сообщение…"
                value={text} onChange={event => setText(event.target.value)}
                className="min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0" />
              <Button type="button" size="icon" variant="ghost" aria-label="Записать голосовое сообщение"
                onClick={() => void audio.start()}>
                <Mic className="size-5" />
              </Button>
              <Button type="submit" size="icon" aria-label="Отправить" disabled={!text.trim()}>
                <ArrowUp className="size-5" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
