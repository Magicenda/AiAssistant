import { describe, expect, it } from "vitest";
import {
  isYandexAuthorizeResponseDto,
  isYandexCalendarStatusDto,
  isYandexSyncResultDto,
} from "./dto";

describe("calendar DTO guards", () => {
  it("accepts a connected calendar", () => {
    expect(
      isYandexCalendarStatusDto({
        connected: true,
        login: "user@yandex.ru",
        connected_at: "2026-11-11T12:00:00+00:00",
      }),
    ).toBe(true);
  });

  it("accepts a disconnected calendar", () => {
    expect(isYandexCalendarStatusDto({ connected: false, login: null, connected_at: null })).toBe(
      true,
    );
  });

  it("rejects a missing flag and a bad connection date", () => {
    expect(isYandexCalendarStatusDto({ login: null, connected_at: null })).toBe(false);
    expect(isYandexCalendarStatusDto({ connected: true, login: "x", connected_at: "nope" })).toBe(
      false,
    );
  });

  it("validates the authorize response", () => {
    expect(
      isYandexAuthorizeResponseDto({
        authorize_url: "https://oauth.yandex.ru/authorize?client_id=1",
      }),
    ).toBe(true);
    expect(isYandexAuthorizeResponseDto({ authorize_url: "" })).toBe(false);
    expect(isYandexAuthorizeResponseDto({})).toBe(false);
  });

  it("validates the sync result", () => {
    expect(isYandexSyncResultDto({ meetings: 2, reminders: 3, failed: 0 })).toBe(true);
    expect(isYandexSyncResultDto({ meetings: 2, reminders: 3 })).toBe(false);
  });
});
