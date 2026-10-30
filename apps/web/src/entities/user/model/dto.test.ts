import { describe, expect, it } from "vitest";
import { isAuthToken, isAuthUser } from "./dto";

describe("isAuthUser", () => {
  it("accepts a valid user", () => {
    expect(
      isAuthUser({
        id: 1,
        username: "alice",
        created_at: "2026-10-29T16:05:29+00:00",
      }),
    ).toBe(true);
  });

  it("rejects invalid shapes", () => {
    expect(isAuthUser(null)).toBe(false);
    expect(isAuthUser({ id: "1", username: "alice", created_at: "x" })).toBe(false);
    expect(isAuthUser({ id: 1, username: 2, created_at: "x" })).toBe(false);
  });
});

describe("isAuthToken", () => {
  it("accepts a bearer token", () => {
    expect(isAuthToken({ access_token: "abc", token_type: "bearer" })).toBe(true);
  });

  it("rejects other token types and empty objects", () => {
    expect(isAuthToken({ access_token: "abc", token_type: "mac" })).toBe(false);
    expect(isAuthToken({})).toBe(false);
  });
});
