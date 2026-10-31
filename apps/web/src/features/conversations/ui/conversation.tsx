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
import {
  clearChatMessages,
  createChat,
  deleteChat,
  deleteChatMessage,
  isChatsLoaded,
  loadChats,
  readChats,
  renameChat,
  setChatPinned,
  subscribeChats,
} from "../model/store";
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
import { plainText } from "@/shared/lib/plain-text";
import { MessageBubble, TypingBubble } from "./message-bubble";
import { ChatList } from "./chat-list";
import { transcribeVoice } from "@/features/assistant";
import type { Chat, ChatMessage } from "@/entities/chat";

const maxLength = 4000;
const maxComposerHeight = 176;
const emptyChats: Chat[] = [];

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
  const text = plainText(value);
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
  const chats = useSyncExternalStore(subscribeChats, readChats, () => emptyChats);
  const hydrated = isChatsLoaded();
  const [sending, setSending] = useState(false);
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
  const replyPending = reply?.status === "streaming" || reply?.status === "saving";

  useEffect(() => {
    void loadChats().catch(cause => {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить чаты.");
    });
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
  const lastUserText = [...messages].reverse().find(message => message.role === "user")?.text ?? "";

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

  /** Валидирует текст, создаёт чат при необходимости и запускает ответ. */
  async function sendText(raw: string) {
    const value = raw.trim();
    if (!value || replyPending || sending) return;
    const snapshot = replyTo
      ? { id: replyTo.id, role: replyTo.role, text: replySnippet(replyTo.text) }
      : undefined;
    setSending(true);
    try {
      let chatId = sessionId;
      if (!chatId) chatId = (await createChat(titleFrom(value))).id;
      setText("");
      writeDraft(draftId, "");
      setReplyTo(null);
      setAtBottom(true);
      setError("");
      requestReply(chatId, value, { replyTo: snapshot });
      if (chatId !== sessionId) router.push(`/chat/${chatId}`);
      textareaRef.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать чат.");
    } finally {
      setSending(false);
    }
  }

  /** Удаляет сообщение на backend и отменяет идущую генерацию. */
  async function deleteMessage(message: ChatMessage) {
    if (!sessionId) return;
    cancelReplies(sessionId);
    if (replyTo?.id === message.id) setReplyTo(null);
    try {
      await deleteChatMessage(sessionId, message.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить сообщение.");
    }
  }

  /** Удаляет чат на backend и его локальный черновик. */
  async function deleteChatById(id: string) {
    cancelReplies(id);
    try {
      await deleteChat(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить чат.");
    }
    removeDraft(id);
    if (id === sessionId) router.push("/chat");
  }

  function togglePin(target: Chat) {
    void setChatPinned(target.id, !target.pinned).catch(cause =>
      setError(cause instanceof Error ? cause.message : "Не удалось закрепить чат."),
    );
  }

  function handlePin() {
    if (!chat) return;
    togglePin(chat);
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
    setRenaming(false);
    if (!value || value === chat?.title) return;
    void renameChat(sessionId, value).catch(cause =>
      setError(cause instanceof Error ? cause.message : "Не удалось переименовать чат."),
    );
  }

  function handleExport() {
    if (!chat) return;
    downloadChat(chat);
    closeMenu();
  }

  /** Двухшаговое подтверждение: первое нажатие просит подтвердить, второе очищает историю. */
  async function handleClear() {
    if (!sessionId) return;
    if (confirmAction !== "clear") {
      setConfirmAction("clear");
      return;
    }
    cancelReplies(sessionId);
    closeMenu();
    setReplyTo(null);
    setText("");
    setNotice("");
    writeDraft(draftId, "");
    try {
      await clearChatMessages(sessionId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось очистить историю.");
    }
  }

  /** Двухшаговое подтверждение: первое нажатие просит подтвердить, второе удаляет чат. */
  function handleDeleteChat() {
    if (!sessionId) return;
    if (confirmAction !== "delete") {
      setConfirmAction("delete");
      return;
    }
    closeMenu();
    void deleteChatById(sessionId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendText(text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  /** Завершает запись, расшифровывает её и отправляет текст в чат. */
  async function handleStop() {
    const clip = await audio.stop();
    if (!clip) return;

    const replySnapshot = replyTo;
    setNotice("");
    setTranscribing(true);

    let chatId = sessionId;
    let createdId: string | null = null;
    try {
      // Чат нужен только как id для распознавания: показываем его после успеха,
      // чтобы при ошибке не оставалось пустого диалога и лишнего перехода.
      if (!chatId) {
        const created = await createChat("Голос");
        chatId = created.id;
        createdId = created.id;
      }
      const transcript = (await transcribeVoice(Number(chatId), clip)).trim();
      if (!transcript) {
        if (createdId) await deleteChat(createdId);
        setNotice("Речь не распознана. Попробуйте записать ещё раз.");
        return;
      }
      if (createdId) void renameChat(chatId, titleFrom(transcript)).catch(() => undefined);
      if (chatId !== sessionId) router.push(`/chat/${chatId}`);
      requestReply(chatId, transcript, {
        replyTo: replySnapshot
          ? {
              id: replySnapshot.id,
              role: replySnapshot.role,
              text: replySnippet(replySnapshot.text),
            }
          : undefined,
      });
    } catch (cause) {
      if (createdId) void deleteChat(createdId).catch(() => undefined);
      setNotice(
        cause instanceof Error
          ? `Не удалось распознать запись: ${cause.message}`
          : "Не удалось распознать запись: сервер распознавания недоступен.",
      );
    } finally {
      setTranscribing(false);
    }
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
          <Button asChild variant="ghost" size="icon">
            <Link
              href={sessionId ? `/voice/${sessionId}` : "/voice"}
              aria-label="Голосовой режим"
              title="Голосовой режим"
            >
              <AudioLines className="size-5" />
            </Link>
          </Button>
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
              onDelete={target => void deleteChatById(target.id)}
              onTogglePin={togglePin}
            />
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="pixel-scrollbar flex h-full flex-col overflow-y-auto overscroll-contain pr-1 pb-4"
        >
          {!hydrated && (
            <p className="text-muted-foreground p-8 text-center font-mono text-xs">
              Загрузка чатов…
            </p>
          )}
          {hydrated && sessionId && !chat && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Logo className="text-muted-foreground mb-6 size-12" />
              <h2 className="font-pixel text-foreground text-2xl">Чат не найден</h2>
              <p className="text-muted-foreground mt-3 max-w-sm font-mono text-xs tracking-wider uppercase">
                Возможно, он удалён. Создайте новый диалог.
              </p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/chat">
                  <Plus className="size-4" />
                  Новый чат
                </Link>
              </Button>
            </div>
          )}
          {hydrated && !hasMessages && !reply && (!sessionId || chat) && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <Logo className="text-primary mb-6 size-12" />
              <h2 className="font-pixel text-foreground text-2xl">Чем помочь?</h2>
              <p className="text-muted-foreground mt-3 max-w-sm font-mono text-xs tracking-wider uppercase">
                Напишите или надиктуйте задачу, встречу или напоминание.
              </p>
            </div>
          )}

          {items.map(item => (
            <Fragment key={item.message.id}>
              {item.separator && <DateSeparator label={item.separator} />}
              <MessageBubble
                message={item.message}
                grouped={item.grouped}
                lastInGroup={item.lastInGroup}
                onReply={setReplyTo}
                onDelete={deleteMessage}
              />
            </Fragment>
          ))}
          {/* Вопрос до подтверждения сервером: backend сохранит его вместе с ответом. */}
          {reply && reply.query && reply.status !== "saving" && (
            <MessageBubble
              message={{
                id: "live-query",
                role: "user",
                text: reply.query,
                replyTo: reply.replyTo,
              }}
              lastInGroup
            />
          )}
          {/* Живой ответ стримится в ленту поверх истории; в чат он попадёт только после завершения. */}
          {reply?.status === "streaming" &&
            (reply.text ? (
              <MessageBubble
                message={{ id: "live-reply", role: "assistant", text: reply.text }}
                lastInGroup
                streaming
              />
            ) : (
              <TypingBubble />
            ))}
          {reply?.status === "saving" && <TypingBubble label="сохраняю ответ" />}
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        requestReply(sessionId, reply.query ?? lastUserText, {
                          replyTo: reply.replyTo,
                        })
                      }
                    >
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
                  {replyTo.text}
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
                    disabled={replyPending || sending}
                    onClick={() => void audio.start()}
                  >
                    <PixelMic className="size-5" />
                  </Button>
                  {reply?.status === "streaming" ? (
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
                      disabled={!text.trim() || sending || replyPending}
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
