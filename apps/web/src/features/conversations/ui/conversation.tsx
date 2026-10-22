"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, Square, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { readChats, writeChats, type Chat } from "../model/store";

type Recognition = {
  lang: string; interimResults: boolean;
  onresult: ((event: { results: { [index: number]: { [index: number]: {
    transcript: string } } } }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
  start(): void; stop(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function Conversation({ sessionId }: { sessionId?: string }) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [listening, setListening] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    setChat(sessionId ? readChats().find(item => item.id === sessionId) ?? null : null);
    return () => {
      const active = recognition.current;
      if (active) {
        active.onresult = null; active.onerror = null; active.onend = null; active.stop();
      }
    };
  }, [sessionId]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);
  function voice() {
    if (listening) { recognition.current?.stop(); return; }
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
    if (!Constructor) {
      setError("Этот браузер не поддерживает распознавание речи. Попробуйте Chrome."); return;
    }
    const active = new Constructor();
    active.lang = "ru-RU"; active.interimResults = false;
    active.onresult = event => setText(previous =>
      `${previous} ${event.results[0][0].transcript}`.trim());
    active.onerror = () => { setError("Не удалось распознать речь. Проверьте доступ к микрофону.");
      setListening(false); };
    active.onend = () => setListening(false);
    recognition.current = active;
    try { active.start(); setListening(true); setError(""); }
    catch { setError("Не удалось включить микрофон."); }
  }
  return <section className="mx-auto flex min-h-[calc(100dvh-7rem)] max-w-3xl flex-col px-0 py-3 sm:px-4 sm:py-7 md:px-8">
    <header className="mb-8 space-y-4 border-b pb-5">
      <h1 className="font-medium">{chat?.title ?? "Новый чат"}</h1>
      <p className="mt-1 text-xs text-muted-foreground">Личное пространство для ваших идей и планов</p>
    </header>
    <div className="flex flex-1 flex-col gap-4">
      {!chat?.messages.length && <div className="my-auto py-16 text-center">
        <span className="mx-auto mb-7 flex size-20 items-center justify-center rounded-3xl border bg-card/60 shadow-lg shadow-primary/5 backdrop-blur-xl">
          <Sparkles className="size-8 text-primary" />
        </span>
        <h2 className="text-3xl font-medium tracking-tight md:text-4xl">С чего начнём?</h2>
        <p className="mt-4 text-sm text-muted-foreground">Напишите сообщение или продиктуйте его голосом.</p>
      </div>}
      {chat?.messages.map((message, index) => <div key={index}
        className="max-w-[85%] self-end whitespace-pre-wrap break-words rounded-3xl rounded-br-lg border bg-card/80 px-5 py-3 text-sm shadow-sm">
        {message}
      </div>)}
      <div ref={bottom} />
    </div>
    <div className="sticky bottom-4 mt-8 rounded-3xl border bg-card/75 p-3 shadow-xl shadow-black/5 backdrop-blur-2xl">
      <form className="flex items-center gap-2" onSubmit={event => {
        event.preventDefault();
        if (!text.trim()) return;
        const chats = readChats();
        const current = chat ?? { id: sessionId ?? crypto.randomUUID(), title: "", messages: [] };
        const next = { ...current, title: current.messages.length ? current.title : text.trim().slice(0, 40),
          messages: [...current.messages, text.trim()] };
        try {
          writeChats([next, ...chats.filter(item => item.id !== next.id)]);
          setChat(next); setText(""); setError("");
          if (!sessionId) router.push(`/chat/${next.id}`);
        } catch { setError("Не удалось сохранить сообщение. Хранилище браузера недоступно."); }
      }}>
        <Input aria-label="Сообщение" placeholder={listening ? "Слушаю…" : "Напишите сообщение…"}
          value={text} onChange={event => setText(event.target.value)}
          className="min-w-0 text-base sm:text-sm border-0 bg-transparent shadow-none" />
        <Button type="button" size="icon" className="shrink-0" variant={listening ? "destructive" : "ghost"}
          aria-label={listening ? "Остановить запись" : "Голосовой ввод"}
          aria-pressed={listening} onClick={voice}>
          {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Button type="submit" size="icon" className="shrink-0" disabled={!text.trim()} aria-label="Отправить">
          <ArrowUp className="size-4" />
        </Button>
      </form>
      {error && <p role="alert" className="px-2 pt-2 text-xs text-destructive">{error}</p>}
      {listening && <p role="status" className="px-2 pt-2 text-xs text-primary">Микрофон включён…</p>}
    </div>
    <p className="mt-3 text-center text-xs text-muted-foreground">
      Сообщения сохраняются в браузере. Ответы AI пока не подключены.
    </p>
  </section>;
}
