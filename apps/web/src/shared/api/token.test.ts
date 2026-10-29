import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getAccessToken,
  notifyUnauthorized,
  setAccessToken,
  setUnauthorizedHandler,
} from "./token";

describe("token store", () => {
  beforeEach(() => {
    clearAccessToken();
    setUnauthorizedHandler(null);
  });

  it("stores and clears the token", () => {
    expect(getAccessToken()).toBeNull();
    setAccessToken("abc");
    expect(getAccessToken()).toBe("abc");
    clearAccessToken();
    expect(getAccessToken()).toBeNull();
  });

  it("notifyUnauthorized clears the token and calls the handler once", () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    setAccessToken("abc");
    notifyUnauthorized();
    expect(getAccessToken()).toBeNull();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("notifyUnauthorized is safe without a handler", () => {
    setAccessToken("abc");
    expect(() => notifyUnauthorized()).not.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});
