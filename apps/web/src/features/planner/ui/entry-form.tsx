"use client";

import { useState, type FormEvent } from "react";
import { Check, X } from "lucide-react";
import { ApiError } from "@/shared/api";
import { getTimeZone } from "@/shared/lib/timezone";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { Entry, EntryDraft, EntryKind } from "../model/entries";

const LABELS: Record<EntryKind, { create: string; edit: string; date: string }> = {
  task: { create: "Новая задача", edit: "Редактирование задачи", date: "Срок" },
  reminder: { create: "Новое напоминание", edit: "Редактирование напоминания", date: "Срок" },
  meeting: { create: "Новая встреча", edit: "Редактирование встречи", date: "Дата и время" },
};

/** Переводит ISO-дату в значение `datetime-local` в часовом поясе браузера. */
function toInputValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Переводит значение `datetime-local` в ISO-строку или `null`. */
function toIsoValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toMessage(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error && cause.message) return cause.message;
  return "Не удалось сохранить запись.";
}

interface EntryFormProps {
  /** Тип создаваемой или редактируемой записи. */
  kind: EntryKind;
  /** Заполняется при редактировании; без него форма создаёт новую запись. */
  initial?: Entry;
  /** Сохраняет значения; при ошибке должна выбросить исключение. */
  onSubmit: (draft: EntryDraft) => Promise<void>;
  /** Закрывает форму без сохранения. */
  onCancel: () => void;
}

/**
 * Встроенная форма создания и редактирования записи профиля.
 *
 * @param props - Пропсы компонента.
 * @returns Разметку формы записи.
 */
export function EntryForm({ kind, initial, onSubmit, onCancel }: EntryFormProps) {
  const labels = LABELS[kind];
  const [description, setDescription] = useState(initial?.title ?? "");
  const [date, setDate] = useState(initial?.date ? toInputValue(initial.date) : "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // У задачи или напоминания без срока дату не требуем: backend не разрешает
  // отправлять null, поэтому меняем только описание.
  const dateRequired = kind === "meeting" || initial?.date !== null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmed = description.trim();
    if (!trimmed) {
      setError("Введите описание.");
      return;
    }
    if (trimmed.length > 255) {
      setError("Описание не должно быть длиннее 255 символов.");
      return;
    }
    if (dateRequired && !date) {
      setError(kind === "meeting" ? "Укажите дату и время встречи." : "Укажите срок.");
      return;
    }

    const iso = toIsoValue(date);
    if (date && !iso) {
      setError("Не удалось разобрать дату и время.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({ description: trimmed, date: iso });
    } catch (cause) {
      setError(toMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="pixel-panel space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-pixel text-foreground text-sm">
          {initial ? labels.edit : labels.create}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Закрыть форму"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="size-4" />
        </Button>
      </div>

      <label className="block space-y-1">
        <span className="text-muted-foreground font-mono text-[0.7rem] tracking-wider uppercase">
          Описание
        </span>
        <Input
          autoFocus
          required
          maxLength={255}
          value={description}
          placeholder="Что нужно сделать"
          onChange={event => setDescription(event.target.value)}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-muted-foreground font-mono text-[0.7rem] tracking-wider uppercase">
          {labels.date}
          {!dateRequired && " (необязательно)"}
        </span>
        <Input
          type="datetime-local"
          required={dateRequired}
          value={date}
          onChange={event => setDate(event.target.value)}
          className="max-w-sm"
        />
        <span className="text-muted-foreground block font-mono text-[0.65rem]">
          Время в вашем часовом поясе: {getTimeZone()}.
        </span>
      </label>

      {error && (
        <p role="alert" className="text-destructive font-mono text-sm">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          <Check className="size-4" />
          {saving ? "Сохраняем…" : initial ? "Сохранить" : "Создать"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
