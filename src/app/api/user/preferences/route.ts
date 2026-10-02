import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { userDataRepository } from "@/lib/server/userDataRepository";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";
import type { UserPreferences } from "@/types/user";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

async function getAuthenticatedUserId(request: NextRequest): Promise<string | null> {
  let token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }
  }
  if (!token) return null;
  const session = await authRepository.getSession(token);
  return session ? session.user.id : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để đồng bộ cài đặt.", 401, NO_CACHE_HEADERS);
    }

    const preferences = await userDataRepository.getPreferences(userId);
    return apiSuccess({ preferences }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể tải cài đặt người dùng.";
    return apiError("PREFERENCES_FETCH_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để lưu cài đặt.", 401, NO_CACHE_HEADERS);
    }

    let body: Partial<UserPreferences> = {};
    try {
      body = (await request.json()) as Partial<UserPreferences>;
    } catch {}

    const preferences = await userDataRepository.savePreferences(userId, body);
    return apiSuccess({ preferences }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể cập nhật cài đặt.";
    return apiError("PREFERENCES_UPDATE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}
