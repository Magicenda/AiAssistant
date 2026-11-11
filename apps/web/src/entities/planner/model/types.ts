/** Источник записи профиля: задача, напоминание или встреча. */
export type PlannerKind = "task" | "reminder" | "meeting";

export interface TaskItemDto {
  id: number;
  type: "task" | "notify";
  description: string;
  deadline: string | null;
  created_at: string;
}

export interface MeetingItemDto {
  id: number;
  description: string;
  appointment: string;
  created_at: string;
}

/** Тело создания задачи или напоминания; срок обязателен по контракту backend. */
export interface TaskInputDto {
  description: string;
  deadline: string;
}

/** Тело изменения задачи или напоминания: любое из полей или оба сразу. */
export interface TaskPatchDto {
  description?: string;
  deadline?: string;
}

/** Тело создания встречи; дата и время обязательны. */
export interface MeetingInputDto {
  description: string;
  appointment: string;
}

/** Тело изменения встречи: любое из полей или оба сразу. */
export interface MeetingPatchDto {
  description?: string;
  appointment?: string;
}
