import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";
import { checkRateLimit } from "@/lib/server/rateLimiter";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = checkRateLimit(`login_${ip}`, 15, 60);

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Quá nhiều lần đăng nhập không thành công. Vui lòng thử lại sau.", 429);
  }

  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return apiError("MISSING_CREDENTIALS", "Vui lòng nhập đầy đủ email và mật khẩu.", 400);
    }

    const storedUser = await authRepository.findByEmail(email);
    if (!storedUser) {
      // Constant-time like safe response to avoid user enumeration
      return apiError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.", 401);
    }

    const isValid = authRepository.verifyPassword(storedUser, password);
    if (!isValid) {
      return apiError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không chính xác.", 401);
    }

    const safeUser = authRepository.getSafeUser(storedUser);
    const session = await authRepository.createSession(safeUser);

    const host = request.headers.get("host") || "";
    const isLocal =
      host.includes("localhost") ||
      host.includes("127.0.0.1") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      request.nextUrl.protocol === "http:";

    const response = apiSuccess({
      ...safeUser,
      user: safeUser,
      token: session.token,
    });

    response.cookies.set(AUTH_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" && !isLocal,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    const userHint = Buffer.from(
      JSON.stringify({
        id: safeUser.id,
        name: safeUser.name,
        email: safeUser.email,
        avatarUrl: safeUser.avatarUrl,
        role: safeUser.role,
        providers: safeUser.providers,
      })
    ).toString("base64url");

    response.cookies.set("rubbyfilm_user_hint", userHint, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production" && !isLocal,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error("Login route exception:", error);
    return apiError("LOGIN_ERROR", error?.message || "Đăng nhập thất bại. Vui lòng thử lại.", 500);
  }
}
