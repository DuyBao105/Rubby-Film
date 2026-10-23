import { NextRequest } from "next/server";
import { apiSuccess } from "@/lib/server/apiResponse";
import { commentService } from "@/lib/community/commentService";
import { validateCommentContent } from "@/lib/community/validators";
import { withAuth, withOptionalAuth, handleError } from "../_util";
import { ensureGuestUser } from "@/lib/community/guestUser";
import { genId } from "@/lib/community/ids";
import { checkRateLimit } from "@/lib/server/rateLimiter";

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
    const { user } = await withOptionalAuth(req);
    const body = await req.json();
    const clean = validateCommentContent(body?.content);
    if (clean == null) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "Nội dung 1..1000 ký tự" } }, { status: 400 });
    }
    if (!body?.movieId) {
      return Response.json({ success: false, error: { code: "BAD_REQUEST", message: "movieId required" } }, { status: 400 });
    }

    // Anti-spam: reject external links, gambling, telegram, zalo
    const hasSpamLink = /(https?:\/\/|www\.|\.com|\.net|\.vn|\.org|\.xyz|\.top|t\.me|zalo\.me|telegram)/i.test(clean);
    if (hasSpamLink) {
      return Response.json({
        success: false,
        error: { code: "BAD_REQUEST", message: "Bình luận không được chứa liên kết ngoài hoặc quảng cáo để bảo vệ cộng đồng." },
      }, { status: 400 });
    }

    // Rate limiting: by user ID or by client IP for guests
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous-ip";
    const rateLimitKey = user ? `user:${user.id}:comment` : `ip:${ip}:comment`;
    const rateCheck = checkRateLimit(rateLimitKey, 10, 60);
    if (!rateCheck.allowed) {
      return Response.json({
        success: false,
        error: { code: "RATE_LIMITED", message: "Bạn đang thao tác quá nhanh, vui lòng đợi 30 giây rồi thử lại." },
      }, { status: 429 });
    }

    // Resolve author: authenticated user or anonymous/guest
    const isAnonymous = Boolean(body?.isAnonymous) || !user;
    let authorId = user?.id;
    let isNewGuest = false;

    if (isAnonymous || !authorId) {
      const guestName =
        typeof body?.authorName === "string" && body.authorName.trim()
          ? body.authorName.trim().slice(0, 30)
          : "Khán giả ẩn danh";

      let guestCookie = req.cookies.get("rubby_guest_id")?.value;
      if (!guestCookie) {
        guestCookie = genId("gst");
        isNewGuest = true;
      }
      await ensureGuestUser(guestCookie, guestName);
      authorId = guestCookie;
    } else {
      await ensureGuestUser(authorId, user.name, user.avatarUrl);
    }

    const c = await commentService.create({
      userId: authorId,
      movieId: String(body.movieId),
      parentId: body.parentId ?? null,
      content: clean,
      isSpoiler: Boolean(body.isSpoiler),
    });

    const res = apiSuccess(c);
    if (isAnonymous && (isNewGuest || !req.cookies.get("rubby_guest_id"))) {
      res.cookies.set("rubby_guest_id", authorId, {
        maxAge: 365 * 24 * 60 * 60,
        path: "/",
        sameSite: "lax",
      });
    }
    return res;
  } catch (e) { return handleError(e); }
}