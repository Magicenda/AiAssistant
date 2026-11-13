import { apiRequest, parseData } from "@/shared/api";
import {
  isMeetingItemDto,
  isMeetingList,
  isTaskItemDto,
  isTaskList,
  type MeetingInputDto,
  type MeetingItemDto,
  type MeetingPatchDto,
  type PlannerKind,
  type TaskInputDto,
  type TaskItemDto,
  type TaskPatchDto,
} from "@/entities/planner";

export interface ProfileQuery {
  limit?: number;
}

/** Задача или напоминание: они живут в разных путях, но в одном формате. */
export type TaskKind = Exclude<PlannerKind, "meeting">;

const TASK_PATHS: Record<TaskKind, string> = {
  task: "/api/profile/tasks",
  reminder: "/api/profile/reminders",
};

function toSearch(query: ProfileQuery): Record<string, string> {
  const search: Record<string, string> = {};
  if (query.limit !== undefined) search.limit = String(query.limit);
  return search;
}

function taskPath(kind: TaskKind): string {
  return TASK_PATHS[kind];
}

export async function getTasks(query: ProfileQuery = {}): Promise<TaskItemDto[]> {
  return parseData(await apiRequest("/api/profile/tasks", { search: toSearch(query) }), isTaskList);
}

export async function getReminders(query: ProfileQuery = {}): Promise<TaskItemDto[]> {
  return parseData(
    await apiRequest("/api/profile/reminders", { search: toSearch(query) }),
    isTaskList,
  );
}

export async function getMeetings(query: ProfileQuery = {}): Promise<MeetingItemDto[]> {
  return parseData(
    await apiRequest("/api/profile/meetings", { search: toSearch(query) }),
    isMeetingList,
  );
}

export async function getTask(kind: TaskKind, id: number): Promise<TaskItemDto> {
  return parseData(await apiRequest(`${taskPath(kind)}/${id}`), isTaskItemDto);
}

export async function getMeeting(id: number): Promise<MeetingItemDto> {
  return parseData(await apiRequest(`/api/profile/meetings/${id}`), isMeetingItemDto);
}

export async function createTask(kind: TaskKind, input: TaskInputDto): Promise<TaskItemDto> {
  return parseData(
    await apiRequest(taskPath(kind), { method: "POST", body: input }),
    isTaskItemDto,
  );
}

export async function createMeeting(input: MeetingInputDto): Promise<MeetingItemDto> {
  return parseData(
    await apiRequest("/api/profile/meetings", { method: "POST", body: input }),
    isMeetingItemDto,
  );
}

export async function updateTask(
  kind: TaskKind,
  id: number,
  patch: TaskPatchDto,
): Promise<TaskItemDto> {
  return parseData(
    await apiRequest(`${taskPath(kind)}/${id}`, { method: "PATCH", body: patch }),
    isTaskItemDto,
  );
}

export async function updateMeeting(id: number, patch: MeetingPatchDto): Promise<MeetingItemDto> {
  return parseData(
    await apiRequest(`/api/profile/meetings/${id}`, { method: "PATCH", body: patch }),
    isMeetingItemDto,
  );
}

export async function deleteTask(kind: TaskKind, id: number): Promise<void> {
  await apiRequest(`${taskPath(kind)}/${id}`, { method: "DELETE" });
}

export async function deleteMeeting(id: number): Promise<void> {
  await apiRequest(`/api/profile/meetings/${id}`, { method: "DELETE" });
}
