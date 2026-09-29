import { NextResponse, NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/server/apiResponse";
import { HttpError, getCurrentUser } from "@/lib/community/getCurrentUser";
import { checkRateLimit } from "@/lib/server/rateLimiter";
import type { AuthUser } from "@/lib/auth/authTypes";

export async function withAuth(
  _req: NextRequest,
  routeKey: string,
  limit: number,
): Promise<{ user: AuthUser; error: null } | { user: null; error: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, error: apiError("UNAUTHENTICATED", "Vui lòng đăng nhập.", 401) };
  }
  const res = checkRateLimit(`${user.id}:${routeKey}`, limit, 60);
  if (!res.allowed) {
    const headers: Record<string, string> = {
      "Retry-After": String(res.resetSeconds),
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": "0",
    };
    return { user: null, error: apiError("RATE_LIMITED", "Bạn đang thao tác quá nhanh.", 429, headers) };
  }
  return { user, error: null };
}

export async function withOptionalAuth(_req: NextRequest): Promise<{ user: AuthUser | null; error: null }> {
  const user = await getCurrentUser();
  return { user, error: null };
}

export function handleError(e: unknown): NextResponse {
  if (e instanceof HttpError) {
    const status = e.code === "UNAUTHENTICATED" ? 401 : 403;
    return apiError(e.code, e.message, status);
  }
  if (e && typeof e === "object" && "code" in e) {
    const code = (e as { code: unknown }).code;
    const message = e instanceof Error ? e.message : "Bad request";
    if (code === "BAD_REQUEST") return apiError("BAD_REQUEST", message, 400);
    if (code === "MAX_DEPTH") return apiError("BAD_REQUEST", "Không thể trả lời sâu hơn.", 400);
    if (code === "FORBIDDEN") return apiError("FORBIDDEN", "Bạn không có quyền.", 403);
    if (code === "NOT_FOUND") return apiError("NOT_FOUND", "Không tìm thấy.", 404);
    if (code === "ALREADY_REPORTED") return apiError("ALREADY_REPORTED", "Bạn đã báo cáo bình luận này rồi.", 409);
  }
  console.error("[community route]", e);
  return apiError("INTERNAL", "Đã xảy ra lỗi.", 500);
}

export { apiSuccess };
