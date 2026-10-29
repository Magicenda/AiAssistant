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
  CircleAlert,
  Clock,
  Download,
  Eraser,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Settings2,
  Square,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Logo } from "@/shared/ui/logo";
import { PixelMic } from "@/shared/ui/pixel-mic";
import { cn } from "@/shared/lib/cn";
import { formatDuration } from "@/shared/lib/format-duration";
import { useAudioRecording } from "../model/use-audio-recording";
import { readChats, removeChat, removeMessage, saveChat, updateChat } from "../model/store";
import { readDraft, removeDraft, writeDraft } from "../model/drafts";
import { downloadChat } from "../model/export-chat";
import {
  cancelReplies,
  getReply,
  requestReply,
  stopReply,
  subscribeReplies,
} from "../model/replies";
import { buildMessageItems } from "../model/chat-view";
import { plainText } from "../model/plain-text";
import { MessageBubble, TypingBubble } from "./message-bubble";
import { ChatList } from "./chat-list";
import { ensureRemoteChat, removeRemoteChat, resetRemoteChat } from "../model/remote";
import { transcribeVoice } from "@/features/assistant";
import type { Chat, ChatMessage } from "@/entities/chat";

const maxLength = 4000;
const maxComposerHeight = 176;

/** Первая непустая строка сообщения, обрезанная до заголовка чата. */
function titleFrom(value: string) {
  const line =
    value
      .split("\n")
      .map(item => item.trim())
      .find(Boolean) ?? value.trim();
  const clean = plainText(line);
  return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean;
}

/** Превью цитируемого сообщения для блока ответа. */
function replySnippet(value: string) {
  const text = plainText(value) || "Голосовое сообщение";
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

/** Кнопка выпадающего меню чата; `danger` включает тревожный цвет. */
function MenuItem({
  onClick,
  danger,
  children,
}: {
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-2 py-2 text-left font-mono text-xs tracking-wider uppercase hover:bg-white/5",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/** Разделитель с подписью даты между группами сообщений. */
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="mt-4 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="bg-border h-px flex-1" />
      <span className="text-muted-foreground font-mono text-[0.65rem] tracking-widest uppercase">
        {label}
      </span>
      <span className="bg-border h-px flex-1" />
    </div>
  );
}

interface ConversationProps {
  /** id открытого чата; без него — новый диалог. */
  sessionId?: string;
}

/**
 * Экран диалога ('use client': состояние композера, локальная история,
 * запись голоса, стриминг ответа через `useSyncExternalStore`).
 *
 * @param props - Пропсы компонента.
 * @returns Разметку чата: шапка, лента сообщений и композер.
 */
export function Conversation({ sessionId }: ConversationProps) {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [transcribing, setTranscribing] = useState(false);
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
  const reply = useSyncExternalStore(
    subscribeReplies,
    () => (sessionId ? getReply(sessionId) : null),
    () => null,
  );
  const replyPending = reply?.status === "streaming";

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
    // Пишем черновик только после чтения: иначе пустая строка затрёт сохранённое.
    const timer = window.setTimeout(() => writeDraft(draftId, text), 250);
    return () => window.clearTimeout(timer);
  }, [draftId, text]);

  const chat = sessionId ? (chats.find(item => item.id === sessionId) ?? null) : null;
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
    el.scrollTo({
      top: el.scrollHeight,
      behavior: firstScroll.current || replyPending ? "auto" : "smooth",
    });
    firstScroll.current = false;
  }, [messages.length, replyPending, reply?.text, atBottom]);

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
  function saveOutgoing(message: ChatMessage, title: string, targetId?: string) {
    const chatId = targetId ?? sessionId ?? crypto.randomUUID();
    const existing = readChats().find(item => item.id === chatId) ?? null;
    try {
      const base: Chat = existing ?? { id: chatId, title, messages: [] };
      saveChat({
        ...base,
        title: base.title || title,
        messages: [...base.messages, message],
      });
    } catch {
      setError("Не удалось сохранить сообщение. Хранилище браузера недоступно.");
      return null;
    }
    setError("");
    setAtBottom(true);
    setReplyTo(null);
    if (chatId !== sessionId) router.push(`/chat/${chatId}`);
    return chatId;
  }

  /** Валидирует текст, сохраняет сообщение и запускает ответ ассистента. */
  function sendText(raw: string) {
    const value = raw.trim();
    if (!value || replyPending) return;
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
    requestReply(chatId);
  }

  /** Удаляет сообщение локально и отменяет идущую генерацию. */
  function deleteMessage(message: ChatMessage) {
    if (!sessionId) return;
    cancelReplies(sessionId);
    removeMessage(sessionId, message.id);
    if (replyTo?.id === message.id) setReplyTo(null);
  }

  /** Удаляет ответ ассистента и генерирует его заново по последнему сообщению. */
  function regenerateMessage(message: ChatMessage) {
    if (!sessionId) return;
    const latest = readChats().find(item => item.id === sessionId);
    if (!latest) return;
    const index = latest.messages.findIndex(item => item.id === message.id);
    if (index < 0) return;
    cancelReplies(sessionId);
    removeMessage(sessionId, message.id);
    requestReply(sessionId);
  }

  /** Удаляет чат локально, его черновик и копию на backend. */
  function deleteChatById(id: string) {
    cancelReplies(id);
    removeRemoteChat(id);
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

  /** Двухшаговое подтверждение: первое нажатие просит подтвердить, второе очищает историю. */
  function handleClear() {
    if (!sessionId) return;
    if (confirmAction !== "clear") {
      setConfirmAction("clear");
      return;
    }
    void resetRemoteChat(sessionId);
    updateChat(sessionId, { messages: [], title: "", remoteId: undefined });
    writeDraft(draftId, "");
    setReplyTo(null);
    setText("");
    setNotice("");
    cancelReplies(sessionId);
    closeMenu();
  }

  /** Двухшаговое подтверждение: первое нажатие просит подтвердить, второе удаляет чат. */
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

  /** Завершает запись, отправляет аудио на транскрипцию и сохраняет сообщение. */
  async function handleStop() {
    const clip = await audio.stop();
    if (!clip) return;

    const targetId = sessionId ?? crypto.randomUUID();
    const replySnapshot = replyTo;
    const existing = readChats().find(item => item.id === targetId);
    if (!existing) {
      try {
        saveChat({ id: targetId, title: "", messages: [] });
      } catch {
        setError("Не удалось создать чат. Хранилище браузера недоступно.");
        return;
      }
    }

    setNotice("");
    setTranscribing(true);
    let transcript = "";
    try {
      const remoteId = await ensureRemoteChat(targetId);
      const blob = await (await fetch(clip.dataUrl)).blob();
      transcript = await transcribeVoice(remoteId, blob);
    } catch (cause) {
      setNotice(
        cause instanceof Error
          ? `Аудио сохранено, но расшифровать не удалось: ${cause.message}`
          : "Аудио сохранено, но сервер распознавания недоступен.",
      );
    } finally {
      setTranscribing(false);
    }

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: transcript,
      createdAt: Date.now(),
      replyTo: replySnapshot
        ? {
            id: replySnapshot.id,
            role: replySnapshot.role,
            text: replySnippet(replySnapshot.text),
          }
        : undefined,
      audio: clip,
    };
    const chatId = saveOutgoing(message, transcript ? titleFrom(transcript) : "Голос", targetId);
    if (chatId && transcript) requestReply(chatId);
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
              className="border-border bg-input font-pixel h-9 max-w-xs border-2 px-2 text-sm"
            />
          ) : (
            <p className="font-pixel text-foreground flex items-center gap-1.5 text-sm">
              {chat?.pinned && (
                <Pin aria-label="Закреплён" className="text-primary size-4 shrink-0" />
              )}
              <span className="truncate">{chat?.title || "Ассистент"}</span>
            </p>
          )}
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Список чатов"
            onClick={() => {
              setHistoryOpen(open => !open);
              closeMenu();
            }}
          >
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
                  <button
                    type="button"
                    aria-label="Закрыть меню"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={closeMenu}
                  />
                  <div className="pixel-panel absolute top-full right-0 z-20 mt-2 w-60 p-1">
                    <MenuItem onClick={startRename}>
                      <Pencil className="size-4" />
                      Переименовать
                    </MenuItem>
                    <MenuItem onClick={handlePin}>
                      <Pin className="size-4" />
                      {chat.pinned ? "Открепить" : "Закрепить"}
                    </MenuItem>
                    <MenuItem onClick={handleExport}>
                      <Download className="size-4" />
                      Экспорт .md
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
            <Plus className="size-4" />
            Новый
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
          className="flex h-full flex-col overflow-y-auto overscroll-contain pr-1 pb-4"
        >
          {hydrated && !hasMessages && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Logo className="text-primary mb-6 size-12" />
              <h2 className="font-pixel text-foreground text-2xl">Чем помочь?</h2>
              <p className="text-muted-foreground mt-3 max-w-sm font-mono text-xs tracking-wider uppercase">
                Напишите или надиктуйте задачу, встречу или напоминание.
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
          {/* Живой ответ стримится в ленту поверх истории; в чат он попадёт только после завершения. */}
          {reply?.status === "streaming" &&
            (reply.text ? (
              <MessageBubble
                message={{ id: "live-reply", role: "assistant", text: reply.text }}
                lastInGroup
              />
            ) : (
              <TypingBubble />
            ))}
          {reply?.status === "error" && (
            <>
              {reply.text && (
                <MessageBubble
                  message={{ id: "live-reply", role: "assistant", text: reply.text }}
                  lastInGroup
                />
              )}
              <div className="pixel-panel mt-3 flex flex-wrap items-start gap-3 p-3" role="alert">
                <CircleAlert className="text-destructive mt-0.5 size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-pixel text-destructive text-xs">Не удалось получить ответ</p>
                  <p className="text-muted-foreground mt-1 font-mono text-xs leading-relaxed">
                    {reply.error}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {sessionId && (
                    <Button size="sm" variant="outline" onClick={() => requestReply(sessionId)}>
                      Повторить
                    </Button>
                  )}
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/settings">
                      <Settings2 className="size-4" />
                      Настройки
                    </Link>
                  </Button>
                  {sessionId && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Скрыть ошибку"
                      onClick={() => cancelReplies(sessionId)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {!atBottom && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            aria-label="К последнему сообщению"
            title="К последнему сообщению"
            className="pixel-bevel absolute right-2 bottom-4 z-10"
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
          <p role="alert" className="text-destructive mb-2 px-2 font-mono text-xs">
            {error || audio.error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="text-muted-foreground mb-2 flex items-start gap-2 px-2 font-mono text-xs"
          >
            <CircleAlert className="text-secondary mt-0.5 size-4 shrink-0" />
            <span>
              {notice}{" "}
              <Link href="/settings" className="text-primary underline underline-offset-4">
                Открыть настройки
              </Link>
            </span>
          </p>
        )}
        <div className="pixel-panel p-2">
          {replyTo && (
            <div className="border-primary mb-2 flex items-start gap-2 border-l-2 px-2 py-1">
              <div className="min-w-0 flex-1">
                <span className="font-pixel text-primary text-[0.65rem]">
                  {replyTo.role === "assistant" ? "Ассистент" : "Вы"}
                </span>
                <p className="text-muted-foreground line-clamp-2 font-mono text-xs">
                  {replyTo.text || "Голосовое сообщение"}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6"
                aria-label="Отменить ответ"
                onClick={() => setReplyTo(null)}
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
          {recording || busy || transcribing ? (
            <div className="flex items-center gap-3 px-2 py-1">
              <span
                className={cn(
                  "bg-secondary size-3 shrink-0",
                  recording || transcribing ? "pixel-blink" : "opacity-50",
                )}
              />
              {!transcribing && (
                <span className="text-foreground font-mono text-sm font-bold tabular-nums">
                  {formatDuration(audio.elapsed)}
                </span>
              )}
              <AudioLines className="text-secondary size-5" />
              <span className="text-muted-foreground ml-auto font-mono text-xs tracking-wider uppercase">
                {transcribing
                  ? "Распознаю речь…"
                  : audio.status === "starting"
                    ? "Включаю микрофон…"
                    : audio.status === "stopping"
                      ? "Сохраняю…"
                      : "Говорите"}
              </span>
              {!transcribing && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Остановить запись"
                  disabled={busy}
                  onClick={() => void handleStop()}
                >
                  <Square className="size-4" />
                </Button>
              )}
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
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Записать голосовое сообщение"
                    disabled={replyPending}
                    onClick={() => void audio.start()}
                  >
                    <PixelMic className="size-5" />
                  </Button>
                  {replyPending ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      aria-label="Остановить ответ"
                      onClick={() => {
                        if (sessionId) stopReply(sessionId);
                      }}
                    >
                      <Square className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      size="icon"
                      aria-label="Отправить"
                      disabled={!text.trim()}
                    >
                      <ArrowUp className="size-5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="text-muted-foreground mt-1 flex min-h-4 items-center justify-between gap-3 px-2 font-mono text-[0.7rem] tracking-wider uppercase">
                <span className="hidden sm:group-focus-within:inline">
                  Enter — отправить · Shift+Enter — новая строка
                </span>
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
