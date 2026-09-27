import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { ratingService } from "@/lib/community/ratingService";
import { validateRating } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";

function bad(message: string) {
  return Response.json({ success: false, error: { code: "BAD_REQUEST", message } }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) return bad("movieId required");
    const { user } = await withOptionalAuth(req);
    const stats = await ratingService.getStats(movieId, user?.id ?? null);
    return apiSuccess(stats);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "ratings.post", 30);
    if (error) return error;
    const body = await req.json();
    const r = validateRating(body?.rating);
    if (r == null) return bad("rating 1..5");
    if (!body?.movieId) return bad("movieId required");
    const stats = await ratingService.upsert({
      userId: user.id, movieId: String(body.movieId), movieSlug: body.movieSlug ?? "", rating: r,
    });
    return apiSuccess(stats);
  } catch (e) { return handleError(e); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await withAuth(req, "ratings.delete", 30);
    if (error) return error;
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) return bad("movieId");
    await ratingService.delete(user.id, movieId);
    return apiSuccess({ ok: true });
  } catch (e) { return handleError(e); }
}
