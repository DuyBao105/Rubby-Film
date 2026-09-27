import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/community/getCurrentUser";
import { reportService, type ReportStatus } from "@/lib/community/reportService";

const ALLOWED: ReadonlyArray<ReportStatus> = ["open", "reviewed", "dismissed", "actioned"];

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status: ReportStatus | undefined =
      statusParam && (ALLOWED as readonly string[]).includes(statusParam)
        ? (statusParam as ReportStatus)
        : undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const result = await reportService.list({ adminId: admin.id, status, page, limit });
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