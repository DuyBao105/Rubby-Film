import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@db/client";
import { comments, commentReports } from "@db/schema";
import { apiSuccess } from "@/lib/server/apiResponse";
import { requireAdmin } from "@/lib/community/getCurrentUser";
import { reportService, type ReportStatus } from "@/lib/community/reportService";

const ALLOWED_STATUS: ReadonlyArray<ReportStatus> = ["open", "reviewed", "dismissed", "actioned"];

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const body = await req.json();
    const status = body?.status as ReportStatus | undefined;
    if (!status || !(ALLOWED_STATUS as readonly string[]).includes(status)) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid status" } }, { status: 400 });
    }
    const action = body?.action as "hide" | "delete" | null | undefined;

    const [report] = await db.select().from(commentReports).where(eq(commentReports.id, id)).limit(1);
    if (!report) {
      return Response.json({ success: false, error: { code: "NOT_FOUND", message: "Không tìm thấy." } }, { status: 404 });
    }

    if (action === "hide") {
      await db.update(comments)
        .set({ deletedAt: new Date(), content: "[removed]" })
        .where(eq(comments.id, report.commentId));
    } else if (action === "delete") {
      await db.delete(comments).where(eq(comments.id, report.commentId));
    }

    await reportService.updateStatus({ reportId: id, adminId: admin.id, status });
    return apiSuccess({ ok: true });
  } catch (e) {
    if (e instanceof Error && "code" in e) {
      const code = (e as { code: unknown }).code;
      if (code === "UNAUTHENTICATED") {
        return Response.json({ success: false, error: { code: "UNAUTHENTICATED", message: e.message } }, { status: 401 });
      }
      if (code === "FORBIDDEN") {
        return Response.json({ success: false, error: { code: "FORBIDDEN", message: e.message } }, { status: 403 });
      }
      if (code === "BAD_REQUEST") {
        return Response.json({ success: false, error: { code: "BAD_REQUEST", message: e.message } }, { status: 400 });
      }
      if (code === "NOT_FOUND") {
        return Response.json({ success: false, error: { code: "NOT_FOUND", message: e.message } }, { status: 404 });
      }
    }
    console.error("[admin/moderation/reports PATCH]", e);
    return Response.json({ success: false, error: { code: "INTERNAL", message: "Đã xảy ra lỗi." } }, { status: 500 });
  }
}