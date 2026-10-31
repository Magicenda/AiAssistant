import { apiRequest, parseData } from "@/shared/api";
import {
  isMeetingList,
  isTaskList,
  type MeetingItemDto,
  type TaskItemDto,
} from "@/entities/planner";

export interface ProfileQuery {
  limit?: number;
}

function toSearch(query: ProfileQuery): Record<string, string> {
  const search: Record<string, string> = {};
  if (query.limit !== undefined) search.limit = String(query.limit);
  return search;
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
