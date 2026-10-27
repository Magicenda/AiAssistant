"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  AudioLines,
  Clock,
  Download,
  Eraser,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Logo } from "@/shared/ui/logo";
import { PixelMic } from "@/shared/ui/pixel-mic";
import { cn } from "@/shared/lib/cn";
import { formatDuration } from "@/shared/lib/format-duration";
import { useAudioRecording, type VoiceClip } from "../model/use-audio-recording";
import {
  readChats,
  removeChat,
  removeMessage,
  saveChat,
  updateChat,
} from "../model/store";
import { readDraft, removeDraft, writeDraft } from "../model/drafts";
import { downloadChat } from "../model/export-chat";
import { isReplyPending, requestReply, subscribeReplies } from "../model/replies";
import { buildMessageItems } from "../model/chat-view";
import { plainText } from "../model/plain-text";
import { MessageBubble, TypingBubble } from "./message-bubble";
import { ChatList } from "./chat-list";
import type { Chat, ChatMessage } from "@/entities/chat";

const maxLength = 4000;
const maxComposerHeight = 176;

function titleFrom(value: string) {
  const line = value.split("\n").map(item => item.trim()).find(Boolean) ?? value.trim();
  const clean = plainText(line);
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

function replySnippet(value: string) {
  const text = plainText(value) || "Голосовое сообщение";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

function MenuItem({ onClick, danger, children }: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-2 text-left font-mono text-xs uppercase tracking-wider hover:bg-white/5",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Conversation({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"clear" | "delete" | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const audio = useAudioRecording();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const firstScroll = useRef(true);
  const draftReady = useRef(false);

  const draftId = sessionId ?? "new";
  const replyPending = useSyncExternalStore(
    subscribeReplies,
    () => (sessionId ? isReplyPending(sessionId) : false),
    () => false,
  );

  useEffect(() => {
    const sync = () => {
      setChats(readChats());
      setHydrated(true);
    };
    sync();
    window.addEventListener("chats-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("chats-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    // Черновик живёт в localStorage: прочитать его можно только на клиенте.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(readDraft(draftId));
    draftReady.current = true;
  }, [draftId]);

  useEffect(() => {
    if (!draftReady.current) return;
    const timer = window.setTimeout(() => writeDraft(draftId, text), 250);
    return () => window.clearTimeout(timer);
  }, [draftId, text]);

  const chat = sessionId ? chats.find(item => item.id === sessionId) ?? null : null;
  const messages = chat?.messages ?? [];
  const items = buildMessageItems(messages);
  const hasMessages = messages.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxComposerHeight)}px`;
  }, [text]);

  useEffect(() => {
    if (!atBottom) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: firstScroll.current ? "auto" : "smooth" });
    firstScroll.current = false;
  }, [messages.length, replyPending, atBottom]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  }

  function closeMenu() {
    setMenuOpen(false);
    setConfirmAction(null);
  }

  /** Сохраняет исходящее сообщение; возвращает id чата или null при ошибке. */
  function saveOutgoing(message: ChatMessage, title: string) {
    const chatId = sessionId ?? crypto.randomUUID();
    const existing = readChats().find(item => item.id === chatId) ?? null;
    try {
      saveChat({
        id: chatId,
        title: existing?.title || title,
        messages: [...(existing?.messages ?? []), message],
      });
    } catch {
      setError("Не удалось сохранить сообщение. Хранилище браузера недоступно.");
      return null;
    }
    setError("");
    setAtBottom(true);
    setReplyTo(null);
    if (!sessionId) router.push(`/chat/${chatId}`);
    return chatId;
  }

  function sendText(raw: string) {
    const value = raw.trim();
    if (!value) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: value,
      createdAt: Date.now(),
      replyTo: replyTo
        ? { id: replyTo.id, role: replyTo.role, text: replySnippet(replyTo.text) }
        : undefined,
    };
    const chatId = saveOutgoing(message, titleFrom(value));
    if (!chatId) return;
    setText("");
    writeDraft(draftId, "");
    textareaRef.current?.focus();
    requestReply(chatId, value);
  }

  function appendVoice(clip: VoiceClip) {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: "",
      createdAt: Date.now(),
      replyTo: replyTo
        ? { id: replyTo.id, role: replyTo.role, text: replySnippet(replyTo.text) }
        : undefined,
      audio: clip,
    };
    const chatId = saveOutgoing(message, "Голос");
    if (chatId) requestReply(chatId, "Голосовое сообщение");
  }

  function deleteMessage(message: ChatMessage) {
    if (!sessionId) return;
    removeMessage(sessionId, message.id);
    if (replyTo?.id === message.id) setReplyTo(null);
  }

  function regenerateMessage(message: ChatMessage) {
    if (!sessionId) return;
    const latest = readChats().find(item => item.id === sessionId);
    if (!latest) return;
    const index = latest.messages.findIndex(item => item.id === message.id);
    if (index < 0) return;
    const source = latest.messages.slice(0, index).reverse()
      .find(item => item.role === "user");
    removeMessage(sessionId, message.id);
    requestReply(sessionId, source?.text || message.text);
  }

  function deleteChatById(id: string) {
    removeChat(id);
    removeDraft(id);
    if (id === sessionId) router.push("/chat");
  }

  function togglePin(target: Chat) {
    updateChat(target.id, { pinned: !target.pinned }, { touch: false });
  }

  function handlePin() {
    if (!chat) return;
    updateChat(chat.id, { pinned: !chat.pinned }, { touch: false });
    closeMenu();
  }

  function startRename() {
    if (!chat) return;
    setRenameValue(chat.title || "");
    setRenaming(true);
    closeMenu();
  }

  function commitRename() {
    if (!sessionId) return;
    const value = renameValue.trim();
    if (value) updateChat(sessionId, { title: value }, { touch: false });
    setRenaming(false);
  }

  function handleExport() {
    if (!chat) return;
    downloadChat(chat);
    closeMenu();
  }

  function handleClear() {
    if (!sessionId) return;
    if (confirmAction !== "clear") {
      setConfirmAction("clear");
      return;
    }
    updateChat(sessionId, { messages: [], title: "" });
    writeDraft(draftId, "");
    setReplyTo(null);
    setText("");
    closeMenu();
  }

  function handleDeleteChat() {
    if (!sessionId) return;
    if (confirmAction !== "delete") {
      setConfirmAction("delete");
      return;
    }
    closeMenu();
    deleteChatById(sessionId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendText(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  async function handleStop() {
    const clip = await audio.stop();
    if (clip) appendVoice(clip);
  }

  function newChat() {
    setHistoryOpen(false);
    closeMenu();
    router.push("/chat");
  }

  const recording = audio.status === "recording";
  const busy = audio.status === "starting" || audio.status === "stopping";
  const nearLimit = text.length > maxLength * 0.9;

  return (
    <section className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-3xl flex-col lg:h-[calc(100dvh-2rem)]">
      <header className="flex items-center justify-between gap-3 pb-4">
        <div className="min-w-0 flex-1">
          {renaming && chat ? (
            <Input
              autoFocus
              aria-label="Название чата"
              value={renameValue}
              onChange={event => setRenameValue(event.target.value)}
              onBlur={commitRename}
              onKeyDown={event => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitRename();
                }
                if (event.key === "Escape") {
                  setRenameValue(chat.title || "");
                  setRenaming(false);
                }
              }}
              className="h-9 max-w-xs border-2 border-border bg-input px-2 font-pixel text-sm"
            />
          ) : (
            <p className="flex items-center gap-1.5 font-pixel text-sm text-foreground">
              {chat?.pinned && (
                <Pin aria-label="Закреплён" className="size-4 shrink-0 text-primary" />
              )}
              <span className="truncate">{chat?.title || "Ассистент"}</span>
            </p>
          )}
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Список чатов"
            onClick={() => {
              setHistoryOpen(open => !open);
              closeMenu();
            }}>
            <Clock className="size-5" />
          </Button>
          {chat && (
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Действия с чатом"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen(open => !open);
                  setConfirmAction(null);
                  setHistoryOpen(false);
                }}
              >
                <MoreHorizontal className="size-5" />
              </Button>
              {menuOpen && (
                <>
                  <button type="button" aria-label="Закрыть меню"
                    className="fixed inset-0 z-10 cursor-default" onClick={closeMenu} />
                  <div className="pixel-panel absolute right-0 top-full z-20 mt-2 w-60 p-1">
                    <MenuItem onClick={startRename}>
                      <Pencil className="size-4" />Переименовать
                    </MenuItem>
                    <MenuItem onClick={handlePin}>
                      <Pin className="size-4" />{chat.pinned ? "Открепить" : "Закрепить"}
                    </MenuItem>
                    <MenuItem onClick={handleExport}>
                      <Download className="size-4" />Экспорт .md
                    </MenuItem>
                    <MenuItem onClick={handleClear} danger={confirmAction === "clear"}>
                      <Eraser className="size-4" />
                      {confirmAction === "clear" ? "Точно очистить?" : "Очистить историю"}
                    </MenuItem>
                    <MenuItem onClick={handleDeleteChat} danger={confirmAction === "delete"}>
                      <Trash2 className="size-4" />
                      {confirmAction === "delete" ? "Точно удалить?" : "Удалить чат"}
                    </MenuItem>
                  </div>
                </>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={newChat}>
            <Plus className="size-4" />Новый
          </Button>
          {historyOpen && (
            <ChatList
              chats={chats}
              currentId={sessionId}
              onNew={newChat}
              onClose={() => setHistoryOpen(false)}
              onDelete={target => deleteChatById(target.id)}
              onTogglePin={togglePin}
            />
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex h-full flex-col overflow-y-auto overscroll-contain pb-4 pr-1"
        >
          {hydrated && !hasMessages && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Logo className="mb-6 size-12 text-primary" />
              <h2 className="font-pixel text-2xl text-foreground">Чем помочь?</h2>
              <p className="mt-3 max-w-sm font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Напишите или надиктуйте задачу, встречу или напоминание.
              </p>
              <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground/70">
                Демо-режим: ассистент повторяет ваши сообщения
              </p>
            </div>
          )}

          {items.map((item, index) => (
            <Fragment key={item.message.id}>
              {item.separator && <DateSeparator label={item.separator} />}
              <MessageBubble
                message={item.message}
                grouped={item.grouped}
                lastInGroup={item.lastInGroup}
                onReply={setReplyTo}
                onDelete={deleteMessage}
                onRegenerate={
                  item.message.role === "assistant" && index === items.length - 1
                    ? regenerateMessage
                    : undefined
                }
              />
            </Fragment>
          ))}
          {replyPending && <TypingBubble />}
        </div>

        {!atBottom && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="К последнему сообщению"
            title="К последнему сообщению"
            className="pixel-bevel absolute bottom-4 right-2 z-10"
            onClick={() => {
              setAtBottom(true);
              const el = scrollRef.current;
              if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
            }}
          >
            <ArrowDown className="size-5" />
          </Button>
        )}
      </div>

      <div className="mt-3 shrink-0">
        {(error || audio.error) && (
          <p role="alert" className="mb-2 px-2 font-mono text-xs text-destructive">{error || audio.error}</p>
        )}
        <div className="pixel-panel p-2">
          {replyTo && (
            <div className="mb-2 flex items-start gap-2 border-l-2 border-primary px-2 py-1">
              <div className="min-w-0 flex-1">
                <span className="font-pixel text-[0.65rem] text-primary">
                  {replyTo.role === "assistant" ? "Ассистент" : "Вы"}
                </span>
                <p className="line-clamp-2 font-mono text-xs text-muted-foreground">
                  {replyTo.text || "Голосовое сообщение"}
                </p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="size-6"
                aria-label="Отменить ответ" onClick={() => setReplyTo(null)}>
                <X className="size-4" />
              </Button>
            </div>
          )}
          {recording || busy ? (
            <div className="flex items-center gap-3 px-2 py-1">
              <span className={cn("size-3 shrink-0 bg-secondary", recording ? "pixel-blink" : "opacity-50")} />
              <span className="font-mono text-sm font-bold tabular-nums text-foreground">
                {formatDuration(audio.elapsed)}
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
            <form className="group" onSubmit={handleSubmit}>
              <div className="flex items-end gap-2">
                <Textarea
                  ref={textareaRef}
                  rows={1}
                  maxLength={maxLength}
                  aria-label="Сообщение"
                  placeholder="Напишите сообщение…"
                  value={text}
                  onChange={event => setText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="max-h-44 min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 leading-relaxed shadow-none focus-visible:ring-0"
                />
                <div className="flex shrink-0 items-center gap-1">
                  <Button type="button" size="icon" variant="ghost"
                    aria-label="Записать голосовое сообщение" onClick={() => void audio.start()}>
                    <PixelMic className="size-5" />
                  </Button>
                  <Button type="submit" size="icon" aria-label="Отправить" disabled={!text.trim()}>
                    <ArrowUp className="size-5" />
                  </Button>
                </div>
              </div>
              <div className="mt-1 flex min-h-4 items-center justify-between gap-3 px-2 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground">
                <span className="hidden sm:group-focus-within:inline">Enter — отправить · Shift+Enter — новая строка</span>
                {text.length > 0 && (
                  <span className={cn("ml-auto tabular-nums", nearLimit && "text-destructive")}>
                    {text.length} / {maxLength}
                  </span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
