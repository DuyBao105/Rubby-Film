import { NextRequest } from "next/server";
import { authRepository, AUTH_COOKIE_NAME } from "@/lib/auth/authService";
import { userDataRepository } from "@/lib/server/userDataRepository";
import { apiSuccess, apiError } from "@/lib/server/apiResponse";
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
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xem danh sách yêu thích.", 401, NO_CACHE_HEADERS);
    }

    const favorites = userDataRepository.getFavorites(userId);
    return apiSuccess({ favorites }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể tải danh sách yêu thích.";
    return apiError("FAVORITES_FETCH_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để lưu danh sách yêu thích.", 401, NO_CACHE_HEADERS);
    }

    const body = (await parseRequestBody(request)) as {
      items?: Movie[];
      movie?: Movie;
    };

    // Case 1: Batch sync of items
    if (Array.isArray(body.items)) {
      const existing = userDataRepository.getFavorites(userId);
      const incoming = body.items;

      const map = new Map<string, Movie>();
      for (const m of [...existing, ...incoming]) {
        const id = String(m.id || m.slug || "").trim();
        if (id && !map.has(id)) {
          map.set(id, m);
        }
      }

      const merged = Array.from(map.values()).slice(0, 100);
      const saved = userDataRepository.saveFavorites(userId, merged);
      return apiSuccess({ favorites: saved }, undefined, NO_CACHE_HEADERS);
    }

    // Case 2: Add individual movie
    if (body.movie) {
      const updated = userDataRepository.addFavorite(userId, body.movie);
      return apiSuccess({ favorites: updated }, undefined, NO_CACHE_HEADERS);
    }

    return apiError("INVALID_PAYLOAD", "Dữ liệu danh sách yêu thích không hợp lệ.", 400, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể cập nhật danh sách yêu thích.";
    return apiError("FAVORITES_UPDATE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      return apiError("UNAUTHORIZED", "Vui lòng đăng nhập để xóa khỏi danh sách yêu thích.", 401, NO_CACHE_HEADERS);
    }

    const { searchParams } = new URL(request.url);
    const idQuery = searchParams.get("id");

    if (idQuery) {
      const updated = userDataRepository.removeFavorite(userId, idQuery);
      return apiSuccess({ favorites: updated }, undefined, NO_CACHE_HEADERS);
    }

    const body = (await parseRequestBody(request)) as { movieId?: string } | null;
    if (body?.movieId) {
      const updated = userDataRepository.removeFavorite(userId, body.movieId);
      return apiSuccess({ favorites: updated }, undefined, NO_CACHE_HEADERS);
    }

    // Clear all
    userDataRepository.clearFavorites(userId);
    return apiSuccess({ favorites: [] }, undefined, NO_CACHE_HEADERS);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Không thể xóa danh sách yêu thích.";
    return apiError("FAVORITES_DELETE_FAILED", msg, 500, NO_CACHE_HEADERS);
  }
}
