"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pin, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";
import {
  chatDateLabel,
  chatTimestamp,
  filterChats,
  groupChats,
  sortChats,
} from "../model/chat-list";
import { plainText } from "../model/plain-text";
import type { Chat } from "@/entities/chat";

/** Превью последнего сообщения для строки списка. */
function preview(chat: Chat) {
  const last = chat.messages.at(-1);
  if (!last) return "Пока нет сообщений";
  if (last.audio) return "Голосовое сообщение";
  return plainText(last.text.split("\n").find(line => line.trim()) ?? last.text);
}

interface RowProps {
  /** id открытого чата — его строка подсвечена. */
  currentId?: string;
  /** id чата, для которого показано подтверждение удаления. */
  confirmId: string | null;
  /** Закрыть список. */
  onClose: () => void;
  /** Удалить чат; подтверждение уже пройдено. */
  onDelete: (chat: Chat) => void;
  /** Закрепить или открепить чат. */
  onTogglePin: (chat: Chat) => void;
  /** Включить или снять подтверждение удаления. */
  onConfirm: (id: string | null) => void;
}

/** Строка чата: превью, дата, закрепление и удаление с подтверждением. */
function ChatRow({ chat, ...props }: RowProps & { chat: Chat }) {
  const { currentId, confirmId, onClose, onDelete, onTogglePin, onConfirm } = props;
  const active = chat.id === currentId;
  const confirming = chat.id === confirmId;

  return (
    <div className="group/row relative">
      <Link
        href={`/chat/${chat.id}`}
        onClick={onClose}
        aria-current={active ? "page" : undefined}
        className={cn("flex flex-col gap-0.5 px-3 py-2 hover:bg-white/5", active && "bg-white/5")}
      >
        <span className="font-pixel text-foreground flex items-center gap-1.5 truncate pr-16 text-xs">
          {chat.pinned ? (
            <Pin className="text-primary size-3 shrink-0" aria-label="Закреплён" />
          ) : null}
          <span className="truncate">{chat.title || "Новый чат"}</span>
        </span>
        <span className="text-muted-foreground truncate pr-14 font-mono text-[0.7rem]">
          {preview(chat)}
        </span>
      </Link>

      {confirming ? (
        <div className="bg-card absolute inset-0 flex items-center justify-between gap-2 px-3">
          <span className="text-destructive font-mono text-[0.7rem] tracking-wider uppercase">
            Удалить чат?
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="destructive" onClick={() => onDelete(chat)}>
              Да
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onConfirm(null)}>
              Нет
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span className="text-muted-foreground/70 pointer-events-none absolute right-2 bottom-2 font-mono text-[0.6rem] tracking-wider uppercase">
            {chatDateLabel(chatTimestamp(chat))}
          </span>
          <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-80 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={chat.pinned ? "Открепить чат" : "Закрепить чат"}
              title={chat.pinned ? "Открепить" : "Закрепить"}
              onClick={() => onTogglePin(chat)}
            >
              <Pin className={cn("size-3.5", chat.pinned && "text-primary fill-current")} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="hover:text-destructive size-6"
              aria-label="Удалить чат"
              title="Удалить чат"
              onClick={() => onConfirm(chat.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Группа строк с заголовком: «Закреплённые», «Сегодня», «Раньше» и т.д. */
function Section({ label, chats, ...rowProps }: RowProps & { label: string; chats: Chat[] }) {
  if (!chats.length) return null;
  return (
    <div>
      <p className="text-muted-foreground px-2 pt-2 pb-1 font-mono text-[0.6rem] tracking-widest uppercase">
        {label}
      </p>
      {chats.map(chat => (
        <ChatRow key={chat.id} chat={chat} {...rowProps} />
      ))}
    </div>
  );
}

interface ChatListProps {
  /** Все чаты локальной истории. */
  chats: Chat[];
  /** id текущего чата. */
  currentId?: string;
  /** Создать новый чат. */
  onNew: () => void;
  /** Закрыть список. */
  onClose: () => void;
  /** Удалить чат. */
  onDelete: (chat: Chat) => void;
  /** Закрепить или открепить чат. */
  onTogglePin: (chat: Chat) => void;
}

/**
 * Диалог со списком чатов ('use client': поиск, подтверждение удаления,
 * модальный `<dialog>`).
 *
 * @param props - Пропсы списка.
 * @returns Модальное окно с поиском и чатами, сгруппированными по давности.
 */
export function ChatList({
  chats,
  currentId,
  onNew,
  onClose,
  onDelete,
  onTogglePin,
}: ChatListProps) {
  const [query, setQuery] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    searchRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      if (dialog.open) dialog.close();
    };
  }, []);

  function handleDelete(chat: Chat) {
    setConfirmId(null);
    if (chat.id === currentId) {
      if (dialogRef.current?.open) dialogRef.current.close();
      onClose();
    }
    onDelete(chat);
  }

  const sorted = sortChats(filterChats(chats, query));
  const pinned = sorted.filter(chat => chat.pinned);
  const groups = groupChats(sorted.filter(chat => !chat.pinned));

  const rowProps = {
    currentId,
    confirmId,
    onClose,
    onDelete: handleDelete,
    onTogglePin,
    onConfirm: setConfirmId,
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Список чатов"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
      className="pixel-panel text-foreground m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0 backdrop:bg-black/70"
    >
      <div className="border-border flex items-center justify-between gap-2 border-b-2 px-3 py-2">
        <span className="font-pixel text-foreground text-xs">
          Чаты <span className="text-muted-foreground">{chats.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onNew}>
            <Plus className="size-4" />
            Новый
          </Button>
          <Button variant="ghost" size="icon" aria-label="Закрыть список чатов" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
      </div>

      <div className="border-border relative border-b-2 px-2 py-2">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
        <Input
          ref={searchRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Поиск по чатам"
          aria-label="Поиск по чатам"
          className="border-border bg-input h-9 border-2 pr-8 pl-8 text-xs"
        />
        {query && (
          <button
            type="button"
            aria-label="Очистить поиск"
            onClick={() => setQuery("")}
            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="pixel-scrollbar max-h-[60vh] overflow-y-auto overscroll-contain p-1">
        {!chats.length && (
          <p className="text-muted-foreground px-3 py-8 text-center font-mono text-xs">
            Пока нет диалогов
          </p>
        )}
        {chats.length > 0 && !sorted.length && (
          <p className="text-muted-foreground px-3 py-8 text-center font-mono text-xs">
            Ничего не найдено
          </p>
        )}

        <Section label="Закреплённые" chats={pinned} {...rowProps} />
        {groups.map(group => (
          <Section key={group.key} label={group.label} chats={group.chats} {...rowProps} />
        ))}
      </div>
    </dialog>
  );
}
