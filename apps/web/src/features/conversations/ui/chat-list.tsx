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

function preview(chat: Chat) {
  const last = chat.messages.at(-1);
  if (!last) return "Пока нет сообщений";
  if (last.audio) return "Голосовое сообщение";
  return plainText(last.text.split("\n").find(line => line.trim()) ?? last.text);
}

interface RowProps {
  currentId?: string;
  confirmId: string | null;
  onClose: () => void;
  onDelete: (chat: Chat) => void;
  onTogglePin: (chat: Chat) => void;
  onConfirm: (id: string | null) => void;
}

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
        className={cn(
          "flex flex-col gap-0.5 px-3 py-2 hover:bg-white/5",
          active && "bg-white/5",
        )}
      >
        <span className="flex items-center gap-1.5 truncate pr-16 font-pixel text-xs text-foreground">
          {chat.pinned ? <Pin className="size-3 shrink-0 text-primary" aria-label="Закреплён" /> : null}
          <span className="truncate">{chat.title || "Новый чат"}</span>
        </span>
        <span className="truncate pr-14 font-mono text-[0.7rem] text-muted-foreground">
          {preview(chat)}
        </span>
      </Link>

      {confirming ? (
        <div className="absolute inset-0 flex items-center justify-between gap-2 bg-card px-3">
          <span className="font-mono text-[0.7rem] uppercase tracking-wider text-destructive">
            Удалить чат?
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="destructive" onClick={() => onDelete(chat)}>Да</Button>
            <Button size="sm" variant="ghost" onClick={() => onConfirm(null)}>Нет</Button>
          </div>
        </div>
      ) : (
        <>
          <span className="pointer-events-none absolute bottom-2 right-2 font-mono text-[0.6rem] uppercase tracking-wider text-muted-foreground/70">
            {chatDateLabel(chatTimestamp(chat))}
          </span>
          <div className="absolute right-1 top-1 flex items-center gap-0.5 opacity-80 transition-opacity sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100">
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label={chat.pinned ? "Открепить чат" : "Закрепить чат"}
              title={chat.pinned ? "Открепить" : "Закрепить"}
              onClick={() => onTogglePin(chat)}
            >
              <Pin className={cn("size-3.5", chat.pinned && "fill-current text-primary")} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6 hover:text-destructive"
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

function Section({ label, chats, ...rowProps }: RowProps & { label: string; chats: Chat[] }) {
  if (!chats.length) return null;
  return (
    <div>
      <p className="px-2 pb-1 pt-2 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {chats.map(chat => <ChatRow key={chat.id} chat={chat} {...rowProps} />)}
    </div>
  );
}

export function ChatList({ chats, currentId, onNew, onClose, onDelete, onTogglePin }: {
  chats: Chat[];
  currentId?: string;
  onNew: () => void;
  onClose: () => void;
  onDelete: (chat: Chat) => void;
  onTogglePin: (chat: Chat) => void;
}) {
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
        if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}
      className="pixel-panel m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg overflow-hidden p-0 text-foreground backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-3 py-2">
        <span className="font-pixel text-xs text-foreground">
          Чаты <span className="text-muted-foreground">{chats.length}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onNew}>
            <Plus className="size-4" />Новый
          </Button>
          <Button variant="ghost" size="icon" aria-label="Закрыть список чатов" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
      </div>

      <div className="relative border-b-2 border-border px-2 py-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Поиск по чатам"
          aria-label="Поиск по чатам"
          className="h-9 border-2 border-border bg-input pl-8 pr-8 text-xs"
        />
        {query && (
          <button
            type="button"
            aria-label="Очистить поиск"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto overscroll-contain p-1">
        {!chats.length && (
          <p className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
            Пока нет диалогов
          </p>
        )}
        {chats.length > 0 && !sorted.length && (
          <p className="px-3 py-8 text-center font-mono text-xs text-muted-foreground">
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
