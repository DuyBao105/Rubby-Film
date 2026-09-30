import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { userDataRepository } from "@/lib/server/userDataRepository";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

async function parseRequestBody(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    try {
      const text = await request.text();
      return text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}

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
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xem lịch sử tìm kiếm.", 401, NO_CACHE_HEADERS);
    }

    const searches = await userDataRepository.getSearchHistory(userId);
    return apiSuccess({ searches }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể tải lịch sử tìm kiếm.";
    return apiError("SEARCH_FETCH_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để lưu lịch sử tìm kiếm.", 401, NO_CACHE_HEADERS);
    }

    const body = await parseRequestBody(request);

    if (Array.isArray(body.searches)) {
      const searches = await userDataRepository.saveSearchHistory(userId, body.searches as string[]);
      return apiSuccess({ searches }, undefined, NO_CACHE_HEADERS);
    }

    if (typeof body.term === "string" && body.term.trim()) {
      const searches = await userDataRepository.addSearchTerm(userId, body.term.trim());
      return apiSuccess({ searches }, undefined, NO_CACHE_HEADERS);
    }

    const current = await userDataRepository.getSearchHistory(userId);
    return apiSuccess({ searches: current }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể lưu lịch sử tìm kiếm.";
    return apiError("SEARCH_SAVE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xóa lịch sử tìm kiếm.", 401, NO_CACHE_HEADERS);
    }

    const url = new URL(request.url);
    const term = url.searchParams.get("term");

    if (term) {
      const searches = await userDataRepository.removeSearchTerm(userId, term);
      return apiSuccess({ searches }, undefined, NO_CACHE_HEADERS);
    }

    const body = await parseRequestBody(request);
    if (typeof body.term === "string" && body.term.trim()) {
      const searches = await userDataRepository.removeSearchTerm(userId, body.term.trim());
      return apiSuccess({ searches }, undefined, NO_CACHE_HEADERS);
    }

    await userDataRepository.clearSearchHistory(userId);
    return apiSuccess({ searches: [] }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể xóa lịch sử tìm kiếm.";
    return apiError("SEARCH_DELETE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}
