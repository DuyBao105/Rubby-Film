import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { userDataRepository } from "@/lib/server/userDataRepository";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";
import type { WatchHistoryItem } from "@/types/user";
import type { Movie } from "@/types/movie";
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
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await authRepository.getSession(token);
  return session ? session.user.id : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xem lịch sử xem phim.", 401, NO_CACHE_HEADERS);
    }

    const history = userDataRepository.getWatchHistory(userId);
    return apiSuccess({ history }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể tải lịch sử xem phim.";
    return apiError("HISTORY_FETCH_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để lưu lịch sử xem phim.", 401, NO_CACHE_HEADERS);
    }

    const body = await parseRequestBody(request);

    // Case 1: Batch sync of items
    if (Array.isArray(body.items)) {
      const existing = userDataRepository.getWatchHistory(userId);
      const incoming = body.items;

      // Merge incoming with existing by choosing latest watchedAt
      const map = new Map<string, WatchHistoryItem>();
      for (const item of [...existing, ...incoming]) {
        const id = String(item.movieId || item.movie?.id || item.slug || "").trim();
        if (!id) continue;
        const current = map.get(id);
        if (!current || (item.watchedAt || 0) >= (current.watchedAt || 0)) {
          map.set(id, item);
        }
      }

      const merged = Array.from(map.values())
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        .slice(0, 50);

      const saved = userDataRepository.saveWatchHistory(userId, merged);
      return apiSuccess({ history: saved }, undefined, NO_CACHE_HEADERS);
    }

    // Case 2: Update individual movie progress
    if (body.movie && typeof body.progressSeconds === "number") {
      const updated = userDataRepository.updateWatchProgress(
        userId,
        body.movie,
        body.progressSeconds,
        body.durationSeconds || body.progressSeconds,
        body.episode
      );
      return apiSuccess({ history: updated }, undefined, NO_CACHE_HEADERS);
    }

    return apiError("INVALID_PAYLOAD", "Dữ liệu cập nhật lịch sử không hợp lệ.", 400, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể cập nhật lịch sử xem.";
    return apiError("HISTORY_UPDATE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xóa lịch sử xem phim.", 401, NO_CACHE_HEADERS);
    }

    const { searchParams } = new URL(request.url);
    const idQuery = searchParams.get("id");

    if (idQuery) {
      const updated = userDataRepository.removeWatchHistory(userId, idQuery);
      return apiSuccess({ history: updated }, undefined, NO_CACHE_HEADERS);
    }

    const body = await parseRequestBody(request);
    if (body?.movieId) {
      const updated = userDataRepository.removeWatchHistory(userId, body.movieId);
      return apiSuccess({ history: updated }, undefined, NO_CACHE_HEADERS);
    }

    // Clear all history
    userDataRepository.clearWatchHistory(userId);
    return apiSuccess({ history: [] }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể xóa lịch sử xem.";
    return apiError("HISTORY_DELETE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}
