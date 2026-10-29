import { describe, expect, it } from "vitest";
import { formatDetail, isValidationIssue } from "./detail";

describe("formatDetail", () => {
  it("returns a plain string detail as-is", () => {
    expect(formatDetail("Чат не найден")).toBe("Чат не найден");
  });

  it("returns null for empty or unusable detail", () => {
    expect(formatDetail(null)).toBeNull();
    expect(formatDetail("")).toBeNull();
    expect(formatDetail(42)).toBeNull();
    expect(formatDetail({})).toBeNull();
  });

  it("joins a single validation issue with its field name", () => {
    expect(formatDetail([
      { loc: ["body", "password"], msg: "String too short", type: "string_too_short" },
    ])).toBe("password: String too short");
  });

  it("joins multiple validation issues", () => {
    expect(formatDetail([
      { loc: ["body", "username"], msg: "too short", type: "x" },
      { loc: ["body", "password"], msg: "too short", type: "x" },
    ])).toBe("username: too short, password: too short");
  });

  it("falls back to null when the array has no valid issues", () => {
    expect(formatDetail([])).toBeNull();
    expect(formatDetail([{ foo: 1 }])).toBeNull();
  });
});

describe("isValidationIssue", () => {
  it("accepts a valid issue", () => {
    expect(isValidationIssue({ loc: ["body"], msg: "m", type: "t" })).toBe(true);
  });

  it("rejects invalid shapes", () => {
    expect(isValidationIssue(null)).toBe(false);
    expect(isValidationIssue({ loc: "body", msg: "m", type: "t" })).toBe(false);
    expect(isValidationIssue({ loc: [], msg: 1, type: "t" })).toBe(false);
  });
});
