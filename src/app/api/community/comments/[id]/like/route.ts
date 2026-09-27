import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { withAuth, handleError } from "../../../_util";
import { likeService } from "@/lib/community/likeService";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { user, error } = await withAuth(req, "comments.like", 60);
    if (error) return error;
    const r = await likeService.toggle({ userId: user.id, commentId: id });
    return apiSuccess(r);
  } catch (e) { return handleError(e); }
}