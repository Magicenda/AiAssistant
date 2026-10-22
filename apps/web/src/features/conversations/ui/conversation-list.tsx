"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";
import { readChats, writeChats, type Chat } from "../model/store";

export function ConversationList() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    const sync = () => setChats(readChats());
    sync();
    window.addEventListener("chats-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("chats-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  function createChat() {
    const chat: Chat = { id: crypto.randomUUID(), title: "Новый чат", messages: [] };
    try {
      writeChats([chat, ...readChats()]);
      setError("");
      router.push(`/chat/${chat.id}`);
    } catch { setError("Не удалось сохранить чат в браузере."); }
  }
  return <div className="mt-3 border-y py-4">
    <div className="mb-3 flex items-center justify-between px-2">
      <h2 className="text-sm font-medium">Чаты</h2>
      <span className="text-xs text-muted-foreground">{chats.length}</span>
    </div>
    <Button className="mb-3 w-full justify-start" variant="outline" onClick={createChat}>
      <Plus className="size-4" />Новый чат
    </Button>
    {chats.length > 0 && <Input aria-label="Поиск чатов" placeholder="Найти чат…"
      value={query} onChange={event => setQuery(event.target.value)} className="mb-2" />}
    <div className="max-h-64 space-y-1 overflow-y-auto">
      {chats.filter(chat => chat.title.toLocaleLowerCase("ru").includes(
        query.toLocaleLowerCase("ru"))).map(chat => <Link key={chat.id} href={`/chat/${chat.id}`}
        aria-current={path === `/chat/${chat.id}` ? "page" : undefined}
        className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm hover:bg-accent",
          path === `/chat/${chat.id}` && "bg-accent text-primary")}>
        <MessageSquare className="size-4 shrink-0" /><span className="min-w-0"><span className="block truncate">{chat.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {chat.messages.at(-1) ?? "Пока нет сообщений"}
          </span></span>
      </Link>)}
      {!chats.length && <p className="px-2 text-xs text-muted-foreground">Нажмите «Новый чат», чтобы начать диалог.</p>}
    </div>
    {chats.length > 0 && !chats.some(chat => chat.title.toLocaleLowerCase("ru")
      .includes(query.toLocaleLowerCase("ru"))) &&
      <p className="px-2 text-xs text-muted-foreground">Чаты не найдены</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
