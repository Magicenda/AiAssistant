import { afterEach, describe, expect, it, vi } from "vitest";
import { clearAccessToken } from "@/shared/api";
import { claimDueReminders } from "./api";

describe("claimDueReminders", () => {
  afterEach(() => {
    clearAccessToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("claims due reminders through the profile API", async () => {
    const reminder = {
      id: 5,
      type: "notify",
      description: "позвонить маме",
      deadline: "2026-11-01T15:00:00+03:00",
      created_at: "2026-10-31T12:00:00+03:00",
    };
    const fetchMock = vi.fn((_input: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify([reminder]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(claimDueReminders()).resolves.toEqual([reminder]);
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(input instanceof Request ? input.url : input);
    expect(url.pathname).toBe("/api/profile/reminders/claim-due");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(init?.method).toBe("POST");
  });
});
