import { NextRequest, NextResponse } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";
import { checkRateLimit } from "@/lib/server/rateLimiter";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
  const rateLimit = checkRateLimit(`register_${ip}`, 10, 60);

  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Quá nhiều yêu cầu đăng ký. Vui lòng thử lại sau.", 429);
  }

  try {
    const body = await request.json();
    const { name, email, password } = body || {};

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return apiError("INVALID_NAME", "Họ và tên phải có ít nhất 2 ký tự.", 400);
    }

    if (!email || typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return apiError("INVALID_EMAIL", "Định dạng email không hợp lệ.", 400);
    }

    if (!password || typeof password !== "string" || password.length < 6) {
      return apiError("WEAK_PASSWORD", "Mật khẩu phải chứa ít nhất 6 ký tự.", 400);
    }

    const user = await authRepository.createUser({
      name: name.trim(),
      email: email.trim(),
      password,
    });

    const session = await authRepository.createSession(user);

    const host = request.headers.get("host") || "";
    const isLocal =
      host.includes("localhost") ||
      host.includes("127.0.0.1") ||
      host.startsWith("192.168.") ||
      host.startsWith("10.") ||
      request.nextUrl.protocol === "http:";

    const response = apiSuccess({
      ...user,
      user,
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
        id: user.id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        providers: user.providers,
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
    return apiError("REGISTER_ERROR", error.message || "Đăng ký không thành công.", 400);
  }
}
