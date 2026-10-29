import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken } from "@/shared/api";
import { fetchEntries } from "./entries";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchEntries", () => {
  beforeEach(() => {
    clearAccessToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("merges tasks, reminders and meetings into the planner model", async () => {
    const fetchMock = vi.fn((input: string) => {
      const path = new URL(input).pathname;
      if (path === "/api/profile/tasks") {
        return Promise.resolve(
          json([
            {
              id: 1,
              type: "task",
              description: "купить хлеб",
              deadline: "2026-10-30T16:05:29+00:00",
              created_at: "2026-10-29T16:05:29+00:00",
            },
          ]),
        );
      }
      if (path === "/api/profile/reminders") {
        return Promise.resolve(
          json([
            {
              id: 2,
              type: "notify",
              description: "позвонить маме",
              deadline: null,
              created_at: "2026-10-29T16:05:29+00:00",
            },
          ]),
        );
      }
      if (path === "/api/profile/meetings") {
        return Promise.resolve(
          json([
            {
              id: 1,
              description: "планёрка",
              appointment: "2026-10-31T10:00:00+00:00",
              created_at: "2026-10-29T16:05:29+00:00",
            },
          ]),
        );
      }
      return Promise.resolve(json({ detail: "not found" }, 404));
    });
    vi.stubGlobal("fetch", fetchMock);

    const entries = await fetchEntries();

    expect(entries).toEqual([
      { id: "task-1", title: "купить хлеб", kind: "task", date: "2026-10-30T16:05:29+00:00" },
      { id: "reminder-2", title: "позвонить маме", kind: "reminder", date: null },
      { id: "meeting-1", title: "планёрка", kind: "meeting", date: "2026-10-31T10:00:00+00:00" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const taskUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(taskUrl.searchParams.get("limit")).toBe("100");
  });
});
