import type { MeetingItemDto, TaskItemDto } from "@/entities/planner";
import { getMeetings, getReminders, getTasks } from "../api";

export type EntryKind = "task" | "meeting" | "reminder";

export interface Entry {
  /** Уникальный id с префиксом источника: id в разных списках пересекаются. */
  id: string;
  title: string;
  kind: EntryKind;
  /** ISO-дата срока/встречи или `null`, если срок не задан. */
  date: string | null;
}

function fromTask(task: TaskItemDto): Entry {
  return { id: `task-${task.id}`, title: task.description, kind: "task", date: task.deadline };
}

function fromReminder(reminder: TaskItemDto): Entry {
  return {
    id: `reminder-${reminder.id}`,
    title: reminder.description,
    kind: "reminder",
    date: reminder.deadline,
  };
}

function fromMeeting(meeting: MeetingItemDto): Entry {
  return {
    id: `meeting-${meeting.id}`,
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
