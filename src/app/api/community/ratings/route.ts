import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { ratingService } from "@/lib/community/ratingService";
import { validateRating } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";
import { ensureGuestUser } from "@/lib/community/guestUser";
import { genId } from "@/lib/community/ids";

function bad(message: string) {
  return Response.json({ success: false, error: { code: "BAD_REQUEST", message } }, { status: 400 });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) return bad("movieId required");
    const { user } = await withOptionalAuth(req);
    const guestCookie = req.cookies.get("rubby_guest_id")?.value;
    const viewerId = user?.id ?? guestCookie ?? null;
    const stats = await ratingService.getStats(movieId, viewerId);
    return apiSuccess(stats);
  } catch (e) { return handleError(e); }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await withOptionalAuth(req);
    const body = await req.json();
    const r = validateRating(body?.rating);
    if (r == null) return bad("rating 1..5");
    if (!body?.movieId) return bad("movieId required");

    let authorId = user?.id;
    let isNewGuest = false;

    if (!authorId) {
      let guestCookie = req.cookies.get("rubby_guest_id")?.value;
      if (!guestCookie) {
        guestCookie = genId("gst");
        isNewGuest = true;
      }
      await ensureGuestUser(guestCookie, "Khán giả");
      authorId = guestCookie;
    }

    const stats = await ratingService.upsert({
      userId: authorId,
      movieId: String(body.movieId),
      movieSlug: body.movieSlug ?? "",
      rating: r,
    });

    const res = apiSuccess(stats);
    if (!user && (isNewGuest || !req.cookies.get("rubby_guest_id"))) {
      res.cookies.set("rubby_guest_id", authorId, {
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
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
