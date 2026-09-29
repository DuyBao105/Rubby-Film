import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { withAuth, handleError } from "../../_util";
import { commentService } from "@/lib/community/commentService";
import { validateCommentContent } from "@/lib/community/validators";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.patch", 10);
    if (error) return error;
    const body = await req.json();
    const clean = validateCommentContent(body?.content);
    if (clean == null) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Nội dung 1..1000 ký tự" } }, { status: 400 });
    }
    const isAdmin = user.role === "admin";
    const c = await commentService.edit({ commentId: id, userId: user.id, isAdmin, content: clean });
    return apiSuccess(c);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.delete", 10);
    if (error) return error;
    const isAdmin = user.role === "admin";
    await commentService.delete({ commentId: id, userId: user.id, isAdmin });
    return apiSuccess({ ok: true });
  } catch (e) { return handleError(e); }
}