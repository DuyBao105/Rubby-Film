import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { commentService } from "@/lib/community/commentService";
import { validateCommentContent } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }, { status: 400 });
    }
    const sortRaw = url.searchParams.get("sort") ?? "newest";
    const sort = (["newest", "oldest", "top"] as const).includes(sortRaw as any)
      ? sortRaw as "newest" | "oldest" | "top"
      : "newest";
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
    const { user } = await withOptionalAuth(req);
    const result = await commentService.list({ movieId, sort, page, limit, viewerId: user?.id ?? null });
    return apiSuccess(result);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "comments.post", 10);
    if (error) return error;
    const body = await req.json();
    const clean = validateCommentContent(body?.content);
    if (clean == null) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Nội dung 1..1000 ký tự" } }, { status: 400 });
    }
    if (!body?.movieId) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }, { status: 400 });
    }
    const c = await commentService.create({
      userId: user.id,
      movieId: String(body.movieId),
      parentId: body.parentId ?? null,
      content: clean,
      isSpoiler: Boolean(body.isSpoiler),
    });
    return apiSuccess(c);
  } catch (e) { return handleError(e); }
}