import { describe, expect, it } from "vitest";
import { isIsoDate } from "./date";

describe("isIsoDate", () => {
  it("accepts ISO strings with and without offset", () => {
    expect(isIsoDate("2026-10-29T16:05:29.085466+00:00")).toBe(true);
    expect(isIsoDate("2026-10-29T16:05:29+00:00")).toBe(true);
    expect(isIsoDate("2026-10-29")).toBe(true);
  });

  it("rejects garbage and non-strings", () => {
    expect(isIsoDate("not-a-date")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(123)).toBe(false);
  });
});
