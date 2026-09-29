import { apiSuccess } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/community/getCurrentUser";
import { reportService } from "@/lib/community/reportService";

export async function GET() {
  try {
    const admin = await requireAdmin();
    const counts = await reportService.counts({ adminId: admin.id });
    return apiSuccess(counts);
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
    console.error("[admin/moderation/reports/counts]", e);
    return Response.json({ success: false, error: { code: "INTERNAL", message: "Đã xảy ra lỗi." } }, { status: 500 });
  }
}
