import { describe, it, expect } from "vitest";
import { validateRating, validateCommentContent, validateReportReason, validateDescription }
  from "@/lib/community/validators";

describe("validateRating", () => {
  it("accepts 1..5 integers", () => {
    for (const n of [1, 2, 3, 4, 5]) expect(validateRating(n)).toBe(n);
  });
  it("rejects 0, 6, fractions, strings, null", () => {
    expect(validateRating(0)).toBeNull();
    expect(validateRating(6)).toBeNull();
    expect(validateRating(3.5)).toBeNull();
    expect(validateRating("4")).toBeNull();
    expect(validateRating(null)).toBeNull();
    expect(validateRating(undefined)).toBeNull();
  });
});

describe("validateCommentContent (Review Focus #3)", () => {
  it("trims and accepts 1..1000 chars", () => {
    expect(validateCommentContent("  hello  ")).toBe("hello");
    expect(validateCommentContent("x".repeat(1000))).toHaveLength(1000);
  });
  it("strips C0/C1 control chars except newline and tab", () => {
    expect(validateCommentContent("a\u0000b\u0007c\nd\te")).toBe("abc\nd\te");
  });
  it("rejects empty, too long, non-string", () => {
    expect(validateCommentContent("")).toBeNull();
    expect(validateCommentContent("   ")).toBeNull();
    expect(validateCommentContent("x".repeat(1001))).toBeNull();
    expect(validateCommentContent(123)).toBeNull();
  });
  it("preserves XSS payload (escaped at render time)", () => {
    const p = "<script>alert(1)</script>";
    expect(validateCommentContent(p)).toBe(p);
  });
});

describe("validateReportReason", () => {
  it("accepts only enum values", () => {
    for (const r of ["spam", "abuse", "harassment", "inappropriate", "spoiler", "other"])
      expect(validateReportReason(r)).toBe(r);
    expect(validateReportReason("bogus")).toBeNull();
    expect(validateReportReason("")).toBeNull();
    expect(validateReportReason(null)).toBeNull();
  });
});

describe("validateDescription", () => {
  it("handles null/empty/trim/length/non-string", () => {
    expect(validateDescription(null)).toBe("");
    expect(validateDescription("")).toBe("");
    expect(validateDescription("  ok  ")).toBe("ok");
    expect(validateDescription("x".repeat(501))).toBeNull();
    expect(validateDescription(123)).toBeNull();
  });
});
