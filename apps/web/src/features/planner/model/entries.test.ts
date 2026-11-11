import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken } from "@/shared/api";
import { createEntry, deleteEntry, fetchEntries, updateEntry, type Entry } from "./entries";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noContent(): Response {
  return new Response(null, { status: 204 });
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
      {
        id: "task-1",
        sourceId: 1,
        title: "купить хлеб",
        kind: "task",
        date: "2026-10-30T16:05:29+00:00",
      },
      { id: "reminder-2", sourceId: 2, title: "позвонить маме", kind: "reminder", date: null },
      {
        id: "meeting-1",
        sourceId: 1,
        title: "планёрка",
        kind: "meeting",
        date: "2026-10-31T10:00:00+00:00",
      },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const taskUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(taskUrl.searchParams.get("limit")).toBe("100");
  });
});

describe("planner entry mutations", () => {
  beforeEach(() => {
    clearAccessToken();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a task in its own path and maps the response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(
        {
          id: 5,
          type: "task",
          description: "Подготовить отчёт",
          deadline: "2026-11-12T12:00:00+00:00",
          created_at: "2026-11-11T12:00:00+00:00",
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const entry = await createEntry("task", {
      description: "Подготовить отчёт",
      date: "2026-11-12T12:00:00+00:00",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/profile/tasks");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Подготовить отчёт",
      deadline: "2026-11-12T12:00:00+00:00",
    });
    expect(entry).toEqual({
      id: "task-5",
      sourceId: 5,
      title: "Подготовить отчёт",
      kind: "task",
      date: "2026-11-12T12:00:00+00:00",
    });
  });

  it("creates a meeting with the appointment field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(
        {
          id: 3,
          description: "Обсудить отчёт",
          appointment: "2026-11-12T13:00:00+00:00",
          created_at: "2026-11-11T12:00:00+00:00",
        },
        201,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const entry = await createEntry("meeting", {
      description: "Обсудить отчёт",
      date: "2026-11-12T13:00:00+00:00",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/profile/meetings");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Обсудить отчёт",
      appointment: "2026-11-12T13:00:00+00:00",
    });
    expect(entry.kind).toBe("meeting");
  });

  it("updates a reminder and sends the new deadline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        id: 2,
        type: "notify",
        description: "Позвонить маме",
        deadline: "2026-11-13T09:00:00+00:00",
        created_at: "2026-11-11T12:00:00+00:00",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const entry: Entry = {
      id: "reminder-2",
      sourceId: 2,
      title: "позвонить маме",
      kind: "reminder",
      date: "2026-11-12T09:00:00+00:00",
    };

    await updateEntry(entry, {
      description: "Позвонить маме",
      date: "2026-11-13T09:00:00+00:00",
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/profile/reminders/2");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({
      description: "Позвонить маме",
      deadline: "2026-11-13T09:00:00+00:00",
    });
  });

  it("omits the deadline when editing a task without one", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json({
        id: 7,
        type: "task",
        description: "Разобрать почту",
        deadline: null,
        created_at: "2026-11-11T12:00:00+00:00",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const entry: Entry = {
      id: "task-7",
      sourceId: 7,
      title: "почта",
      kind: "task",
      date: null,
    };

    await updateEntry(entry, { description: "Разобрать почту", date: null });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ description: "Разобрать почту" });
  });

  it("deletes a meeting by id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(noContent());
    vi.stubGlobal("fetch", fetchMock);
    const entry: Entry = {
      id: "meeting-4",
      sourceId: 4,
      title: "Планёрка",
      kind: "meeting",
      date: "2026-11-12T10:00:00+00:00",
    };

    await deleteEntry(entry);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new URL(url).pathname).toBe("/api/profile/meetings/4");
    expect(init.method).toBe("DELETE");
  });
});
