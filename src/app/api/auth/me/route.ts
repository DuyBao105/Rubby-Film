import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(request: NextRequest) {
  try {
    let token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return apiSuccess({ user: null, authenticated: false }, undefined, NO_CACHE_HEADERS);
    }

    const session = await authRepository.getSession(token);
    if (!session) {
      return apiSuccess({ user: null, authenticated: false }, undefined, NO_CACHE_HEADERS);
    }

    return apiSuccess(
      {
        user: session.user,
        token: session.token,
        authenticated: true,
      },
      undefined,
      NO_CACHE_HEADERS
    );
  } catch (error) {
    return apiError("AUTH_CHECK_FAILED", "Không thể xác thực phiên đăng nhập.", 500, NO_CACHE_HEADERS);
  }
}
