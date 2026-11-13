import type { MeetingItemDto, PlannerKind, TaskItemDto } from "@/entities/planner";
import {
  createMeeting,
  createTask,
  deleteMeeting,
  deleteTask,
  getMeetings,
  getReminders,
  getTasks,
  updateMeeting,
  updateTask,
} from "../api";

export type EntryKind = PlannerKind;

export interface Entry {
  /** Уникальный id с префиксом источника: id в разных списках пересекаются. */
  id: string;
  /** Числовой id записи в своём списке backend. */
  sourceId: number;
  title: string;
  kind: EntryKind;
  /** ISO-дата срока/встречи или `null`, если срок не задан. */
  date: string | null;
}

/** Поля, которые пользователь меняет в форме записи; дата — ISO или `null`. */
export interface EntryDraft {
  description: string;
  date: string | null;
}

function fromTask(task: TaskItemDto): Entry {
  return {
    id: `task-${task.id}`,
    sourceId: task.id,
    title: task.description,
    kind: "task",
    date: task.deadline,
  };
}

function fromReminder(reminder: TaskItemDto): Entry {
  return {
    id: `reminder-${reminder.id}`,
    sourceId: reminder.id,
    title: reminder.description,
    kind: "reminder",
    date: reminder.deadline,
  };
}

function fromMeeting(meeting: MeetingItemDto): Entry {
  return {
    id: `meeting-${meeting.id}`,
    sourceId: meeting.id,
    title: meeting.description,
    kind: "meeting",
    date: meeting.appointment,
  };
}

/** Тянет задачи, напоминания и встречи из профиля и сводит в единый список. */
export async function fetchEntries(): Promise<Entry[]> {
  const [tasks, reminders, meetings] = await Promise.all([
    getTasks({ limit: 100 }),
    getReminders({ limit: 100 }),
    getMeetings({ limit: 100 }),
  ]);
  return [...tasks.map(fromTask), ...reminders.map(fromReminder), ...meetings.map(fromMeeting)];
}

/** Создаёт запись выбранного типа; срок обязателен для всех трёх списков. */
export async function createEntry(kind: EntryKind, draft: EntryDraft): Promise<Entry> {
  if (!draft.date) throw new Error("Укажите дату и время.");

  if (kind === "meeting") {
    return fromMeeting(
      await createMeeting({ description: draft.description, appointment: draft.date }),
    );
  }

  const task = await createTask(kind, { description: draft.description, deadline: draft.date });
  return kind === "task" ? fromTask(task) : fromReminder(task);
}

/**
 * Сохраняет изменения записи. Для записи без срока дату не отправляем:
 * backend не принимает `null`, а описание меняется отдельным полем.
 */
export async function updateEntry(entry: Entry, draft: EntryDraft): Promise<Entry> {
  if (entry.kind === "meeting") {
    if (!draft.date) throw new Error("Укажите дату и время встречи.");
    return fromMeeting(
      await updateMeeting(entry.sourceId, {
        description: draft.description,
        appointment: draft.date,
      }),
    );
  }

  const patch = draft.date
    ? { description: draft.description, deadline: draft.date }
    : { description: draft.description };
  const task = await updateTask(entry.kind, entry.sourceId, patch);
  return entry.kind === "task" ? fromTask(task) : fromReminder(task);
}

/** Удаляет запись из соответствующего списка backend. */
export async function deleteEntry(entry: Entry): Promise<void> {
  if (entry.kind === "meeting") {
    await deleteMeeting(entry.sourceId);
    return;
  }
  await deleteTask(entry.kind, entry.sourceId);
}
