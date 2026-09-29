export function validateRating(raw: unknown): number | null {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 5) return null;
  return raw;
}
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
export function validateCommentContent(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(CONTROL, "").trim();
  if (cleaned.length < 1 || cleaned.length > 1000) return null;
  return cleaned;
}
export const REPORT_REASONS = ["spam", "abuse", "harassment", "inappropriate", "spoiler", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export function validateReportReason(raw: unknown): ReportReason | null {
  return typeof raw === "string" && (REPORT_REASONS as readonly string[]).includes(raw)
    ? (raw as ReportReason)
    : null;
}
export function validateDescription(raw: unknown): string | null {
  if (raw == null || raw === "") return "";
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim();
  if (cleaned.length > 500) return null;
  return cleaned;
}
