"use client";

import * as React from "react";

import type { CommunityEvent } from "@/lib/community/events";

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit-testing under node env, no jsdom required).
// ---------------------------------------------------------------------------

/**
 * Insert `item` into `items` only if its `id` is not already present.
 * Preserves original insertion order: existing items stay where they were,
 * the new item is appended at the end.
 */
export function dedupeById<T extends { id: string }>(items: T[], item: T): T[] {
  if (items.some((x) => x.id === item.id)) return items;
  return [...items, item];
}

export type CommunityCommentLike = {
  id: string;
  parentId: string | null;
  [k: string]: unknown;
};

/**
 * Apply a SSE comment_created event by inserting into the right tree node
 * (top-level or nested under parent). Drops duplicates by id (returns the
 * same reference when no insertion happens — safe for setState bailout).
 * Flat siblings of the target parent are folded into parent.replies so the
 * result is always a normalized two-level tree.
 */
export function applyEventUpsert<T extends CommunityCommentLike>(
  items: T[],
  eventType: "comment_created" | "comment_updated" | "comment_deleted",
  incoming: T,
): T[] {
  if (eventType !== "comment_created" && eventType !== "comment_updated") {
    return items;
  }
  if (incoming.parentId == null) {
    return dedupeById(items, incoming);
  }
  const parentId = incoming.parentId;
  const flatSiblings = items.filter((it) => it.parentId === parentId && it.id !== parentId);
  let changed = false;
  const next: T[] = [];
  for (const it of items) {
    if (it.id === parentId) {
      const replies = Array.isArray((it as any).replies) ? ((it as any).replies as T[]) : [];
      const candidates = [...replies, ...flatSiblings];
      const merged = dedupeById(candidates, incoming);
      const structurallyChanged =
        flatSiblings.length > 0 ||
        merged.length !== replies.length ||
        merged.some((m, i) => m !== replies[i]);
      if (structurallyChanged) {
        changed = true;
        next.push({ ...it, replies: merged } as unknown as T);
      } else {
        next.push(it);
      }
      continue;
    }
    if (it.parentId === parentId) {
      // Folded into the parent entry above — drop from top level.
      changed = true;
      continue;
    }
    next.push(it);
  }
  return changed ? next : items;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export interface RatingStats {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  viewerRating: number | null;
}

export function useRating(movieId: string, movieSlug: string) {
  const [stats, setStats] = React.useState<RatingStats | null>(null);
  const [viewerRating, setViewerRating] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    if (!movieId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/community/ratings?movieId=${encodeURIComponent(movieId)}`,
        { credentials: "include", cache: "no-store" },
      );
      const j = await res.json();
      if (j?.success) {
        setStats(j.data as RatingStats);
        setViewerRating((j.data?.viewerRating ?? null) as number | null);
        setError(null);
      } else {
        setError(j?.error?.message ?? "Không tải được đánh giá.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Lỗi mạng.");
    } finally {
      setIsLoading(false);
    }
  }, [movieId]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const rate = React.useCallback(
    async (n: number) => {
      const res = await fetch("/api/community/ratings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieId, movieSlug, rating: n }),
      });
      const j = await res.json();
      if (j?.success) {
        setStats(j.data as RatingStats);
        setViewerRating((j.data?.viewerRating ?? null) as number | null);
        return { ok: true as const };
      }
      return { ok: false as const, code: j?.error?.code, message: j?.error?.message };
    },
    [movieId, movieSlug],
  );

  const removeRating = React.useCallback(async () => {
    const res = await fetch(
      `/api/community/ratings?movieId=${encodeURIComponent(movieId)}`,
      { method: "DELETE", credentials: "include" },
    );
    const j = await res.json();
    if (j?.success) {
      setStats((prev) =>
        prev
          ? {
              ...prev,
              viewerRating: null,
              count: Math.max(0, prev.count - (prev.viewerRating ? 1 : 0)),
            }
          : prev,
      );
      setViewerRating(null);
      await reload();
    }
    return j?.success === true;
  }, [movieId, reload]);

  return { stats, viewerRating, isLoading, error, rate, removeRating, reload };
}

export interface CommentListPage {
  items: Array<{
    id: string;
    parentId: string | null;
    content: string;
    isSpoiler: boolean;
    createdAt: number;
    updatedAt: number;
    deletedAt: number | null;
    author: { id: string; name: string; avatarUrl?: string; role: "user" | "vip" | "admin" };
    likeCount: number;
    likedByViewer: boolean;
    replies?: any[];
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function useComments(movieId: string, initialSort: "newest" | "oldest" | "top" = "newest") {
  const [items, setItems] = React.useState<CommentListPage["items"]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [sort, setSort] = React.useState(initialSort);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!movieId) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = new URL("/api/community/comments", window.location.origin);
      url.searchParams.set("movieId", movieId);
      url.searchParams.set("sort", sort);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (j?.success) {
        setItems(j.data.items);
        setTotal(j.data.total);
        setTotalPages(j.data.totalPages);
      } else {
        setError(j?.error?.message ?? "Không tải được bình luận.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Lỗi mạng.");
    } finally {
      setIsLoading(false);
    }
  }, [movieId, sort, page, limit]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyCreated = React.useCallback(
    (c: CommentListPage["items"][number]) => {
      setItems((prev) => applyEventUpsert(prev as any, "comment_created", c as any) as any);
      setTotal((prev) => prev + 1);
    },
    [],
  );

  const handleSetSort = React.useCallback(
    (newSort: "newest" | "oldest" | "top") => {
      setSort(newSort);
      setItems((prev) => {
        const copy = [...prev];
        if (newSort === "oldest") {
          return copy.sort((a, b) => a.createdAt - b.createdAt);
        } else if (newSort === "top") {
          return copy.sort((a, b) => (b.likeCount - a.likeCount) || (b.createdAt - a.createdAt));
        } else {
          return copy.sort((a, b) => b.createdAt - a.createdAt);
        }
      });
    },
    [],
  );

  return {
    items,
    total,
    page,
    setPage,
    limit,
    totalPages,
    sort,
    setSort: handleSetSort,
    isLoading,
    error,
    refresh,
    applyCreated,
  };
}

export function useCommentStream(
  movieId: string,
  onEvent: (e: CommunityEvent) => void,
  enabled = true,
) {
  React.useEffect(() => {
    if (!movieId || !enabled || typeof window === "undefined") return;
    let es: EventSource | null = null;
    let stopped = false;
    const open = () => {
      if (stopped) return;
      es = new EventSource(`/api/community/stream?movieId=${encodeURIComponent(movieId)}`);
      es.addEventListener("hello", () => {/* keep-alive */});
      const dispatch = (raw: MessageEvent) => {
        try {
          const ev = JSON.parse(raw.data);
          if (ev && typeof ev === "object" && ev.movieId === movieId) onEvent(ev);
        } catch {/* ignore */}
      };
      ["rating_upserted", "rating_deleted", "comment_created", "comment_updated", "comment_deleted", "like_changed", "report_created"].forEach((t) => {
        es!.addEventListener(t, dispatch as EventListener);
      });
      es.addEventListener("end", () => {
        es?.close();
        es = null;
        // Server forces 55s reconnect — wait a tick then reopen.
        setTimeout(open, 250);
      });
      es.addEventListener("error", () => {
        es?.close();
        es = null;
        // 15s polling fallback per plan spec — reconnect after delay.
        setTimeout(open, 3000);
      });
    };
    open();
    return () => {
      stopped = true;
      es?.close();
    };
  }, [movieId, onEvent, enabled]);
}

export function useLike(commentId: string, initialLiked: boolean, initialCount: number) {
  const [liked, setLiked] = React.useState(initialLiked);
  const [count, setCount] = React.useState(initialCount);
  const [busy, setBusy] = React.useState(false);
  const toggleRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingToggles = React.useRef(0);

  React.useEffect(() => {
    setLiked(initialLiked);
    setCount(initialCount);
  }, [initialLiked, initialCount, commentId]);

  const toggle = React.useCallback(async () => {
    if (busy) return;
    pendingToggles.current += 1;
    if (toggleRef.current) clearTimeout(toggleRef.current);
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    toggleRef.current = setTimeout(async () => {
      const flips = pendingToggles.current;
      pendingToggles.current = 0;
      if (flips % 2 === 0) return; // double-tap = no net change, skip POST
      setBusy(true);
      try {
        const res = await fetch(`/api/community/comments/${commentId}/like`, {
          method: "POST",
          credentials: "include",
        });
        const j = await res.json();
        if (j?.success && typeof j.data?.liked === "boolean") {
          setLiked(j.data.liked);
          setCount(typeof j.data.count === "number" ? j.data.count : count);
        } else {
          setLiked(initialLiked);
          setCount(initialCount);
        }
      } catch {
        setLiked(initialLiked);
        setCount(initialCount);
      } finally {
        setBusy(false);
      }
    }, 250);
  }, [busy, liked, count, commentId, initialLiked, initialCount]);

  React.useEffect(
    () => () => {
      if (toggleRef.current) clearTimeout(toggleRef.current);
    },
    [],
  );

  return { liked, count, toggle, busy };
}
export function useReport() {
  const submit = React.useCallback(
    async (commentId: string, reason: string, description?: string) => {
      const res = await fetch(`/api/community/comments/${commentId}/report`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, description: description ?? "" }),
      });
      const j = await res.json();
      return {
        ok: Boolean(j?.success),
        code: j?.error?.code,
        message: j?.error?.message,
      };
    },
    [],
  );
  return { submit };
}

export interface UserProfilePreview {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "user" | "vip" | "admin";
  createdAt: number;
  commentCount: number;
}

export function useProfilePreview(userId: string | null) {
  const [data, setData] = React.useState<UserProfilePreview | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/users/${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j?.success) setData(j.data as UserProfilePreview);
        else setError(j?.error?.message ?? "Không tải được hồ sơ.");
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Lỗi mạng.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { data, isLoading, error };
}

