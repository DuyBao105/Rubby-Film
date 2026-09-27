import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { withAuth, handleError } from "../../../_util";
import { reportService } from "@/lib/community/reportService";
import { validateReportReason, validateDescription } from "@/lib/community/validators";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.report", 5);
    if (error) return error;
    const body = await req.json();
    const reason = validateReportReason(body?.reason);
    if (reason == null) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Invalid reason" } }, { status: 400 });
    }
    const desc = validateDescription(body?.description);
    if (desc == null && body?.description != null) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Description quá dài" } }, { status: 400 });
    }
    await reportService.create({
      reporterUserId: user.id,
      commentId: id,
      reason,
      description: desc ?? null,
    });
    return apiSuccess({ ok: true });
  } catch (e) { return handleError(e); }
}