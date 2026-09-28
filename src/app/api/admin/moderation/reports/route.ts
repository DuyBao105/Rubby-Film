import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/community/getCurrentUser";
import { reportService, type ReportStatus, type ReportSort } from "@/lib/community/reportService";
import type { ReportReason } from "@/lib/community/validators";

const ALLOWED_STATUS: ReadonlyArray<ReportStatus> = ["open", "reviewed", "dismissed", "actioned"];
const ALLOWED_REASON: ReadonlyArray<ReportReason> = ["spam", "abuse", "harassment", "inappropriate", "spoiler", "other"];
const ALLOWED_SORT: ReadonlyArray<ReportSort> = ["newest", "oldest"];

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status: ReportStatus | undefined =
      statusParam && (ALLOWED_STATUS as readonly string[]).includes(statusParam)
        ? (statusParam as ReportStatus)
        : undefined;
    const reasonParam = url.searchParams.get("reason");
    const reason: ReportReason | undefined =
      reasonParam && (ALLOWED_REASON as readonly string[]).includes(reasonParam)
        ? (reasonParam as ReportReason)
        : undefined;
    const sortParam = url.searchParams.get("sort");
    const sort: ReportSort =
      sortParam && (ALLOWED_SORT as readonly string[]).includes(sortParam) ? (sortParam as ReportSort) : "newest";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const result = await reportService.list({ adminId: admin.id, status, reason, sort, page, limit });
    return apiSuccess(result);
  } catch (e) {
    if (e instanceof Error && "code" in e) {
      const code = (e as { code: unknown }).code;
      if (code === "UNAUTHENTICATED") {
        return Response.json({ success: false, error: { code: "UNAUTHENTICATED", message: e.message } }, { status: 401 });
      }
      if (code === "FORBIDDEN") {
        return Response.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
      }
    }
    console.error("[admin/moderation/reports]", e);
    return Response.json({ success: false, error: { code: "INTERNAL", message: "Đã xảy ra lỗi." } }, { status: 500 });
  }
}