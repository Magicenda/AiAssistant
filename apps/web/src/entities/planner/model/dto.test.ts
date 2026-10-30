import { describe, expect, it } from "vitest";
import { isMeetingItemDto, isMeetingList, isTaskItemDto, isTaskList } from "./dto";

describe("planner DTO guards", () => {
  it("accepts tasks and reminders with or without a deadline", () => {
    expect(
      isTaskItemDto({
        id: 2,
        type: "task",
        description: "купить хлеб",
        deadline: "2026-10-30T16:05:29+00:00",
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(true);
    expect(
      isTaskItemDto({
        id: 2,
        type: "notify",
        description: "x",
        deadline: null,
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(true);
  });

  it("rejects wrong task types and bad deadlines", () => {
    expect(
      isTaskItemDto({
        id: 2,
        type: "meeting",
        description: "x",
        deadline: null,
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(false);
    expect(
      isTaskItemDto({
        id: 2,
        type: "task",
        description: "x",
        deadline: "nope",
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(false);
  });

  it("validates meetings", () => {
    expect(
      isMeetingItemDto({
        id: 1,
        description: "планёрка",
        appointment: "2026-10-31T10:00:00+00:00",
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(true);
    expect(
      isMeetingItemDto({
        id: 1,
        description: "планёрка",
        appointment: null,
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(false);
  });

  it("validates lists", () => {
    expect(isTaskList([])).toBe(true);
    expect(isMeetingList([])).toBe(true);
    expect(isTaskList([{ id: 1 }])).toBe(false);
  });
});
