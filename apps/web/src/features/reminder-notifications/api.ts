import { isTaskList, type TaskItemDto } from "@/entities/planner";
import { apiRequest, parseData } from "@/shared/api";

/** Забирает наступившие напоминания, которые ещё не показывались пользователю. */
export async function claimDueReminders(limit = 20): Promise<TaskItemDto[]> {
  return parseData(
    await apiRequest("/api/profile/reminders/claim-due", {
      method: "POST",
      search: { limit: String(limit) },
    }),
    isTaskList,
  );
}
