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
