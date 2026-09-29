"use client";

import { Star } from "lucide-react";
import * as React from "react";

import { useAuth } from "@/lib/auth/authContext";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

import { RatingStars } from "./rating-stars";
import { RatingDistribution } from "./rating-distribution";
import { useRating, useCommentStream } from "@/hooks/use-community";
import type { CommunityEvent } from "@/lib/community/events";

interface RatingSectionProps {
  movieId: string;
  movieSlug: string;
  /** Optional jump filter callback forwarded from distribution row clicks. */
  onJumpToComments?: (sort: "top") => void;
}

/**
 * Standalone section "Đánh giá của khán giả". Mounted as a client island via
 * next/dynamic({ ssr: false }) inside movie-detail. Guest clicks open
 * AuthModal via useAuth().openAuthModal("login").
 */
export function RatingSection({ movieId, movieSlug, onJumpToComments }: RatingSectionProps) {
  const { user, openAuthModal } = useAuth();
  const toast = useToast();
  const { stats, viewerRating, isLoading, error, rate, removeRating, reload } = useRating(movieId, movieSlug);
  const [busy, setBusy] = React.useState(false);

  // Refresh on community SSE rating_upserted / rating_deleted for this movie.
  useCommentStream(
    movieId,
    React.useCallback(
      (ev: CommunityEvent) => {
        if (ev.type === "rating_upserted" || ev.type === "rating_deleted") {
          void reload();
        }
      },
      [reload],
    ),
  );

  const onRate = React.useCallback(
    async (n: number) => {
      if (!user) {
        openAuthModal("login");
        return;
      }
      setBusy(true);
      const r = await rate(n);
      setBusy(false);
      if (!r.ok) {
        if (r.code === "UNAUTHENTICATED") {
          openAuthModal("login");
        } else if (r.code === "RATE_LIMITED") {
          toast.error("Bạn đang thao tác quá nhanh.", "Vui lòng đợi một chút rồi thử lại.");
        } else {
          toast.error("Không thể gửi đánh giá", r.message ?? "Thử lại sau.");
        }
      }
    },
    [user, openAuthModal, rate, toast],
  );

  const onRemove = React.useCallback(async () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    const ok = await removeRating();
    if (!ok) toast.error("Không thể xoá đánh giá.", "Thử lại sau.");
  }, [user, openAuthModal, removeRating, toast]);

  const avg = stats?.average ?? 0;
  const cnt = stats?.count ?? 0;

  return (
    <section
      aria-label="Đánh giá của khán giả"
      className={cn(
        "rounded-xl border border-cinema-800 bg-cinema-900/50 p-4 md:p-6",
        "shadow-lg shadow-black/30",
      )}
    >
      <h2 className="text-lg font-semibold text-cinema-100 mb-4 flex items-center gap-2">
        <Star className="w-4 h-4 text-cinema-500" />
        <span>Đánh giá của khán giả</span>
      </h2>

      {error && (
        <p className="text-xs text-red-400 mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
        <div className="text-center">
          <div className="text-4xl font-bold text-cinema-50 tabular-nums">
            {isLoading ? "—" : avg.toFixed(1)}
          </div>
          <div className="text-xs text-cinema-400 mt-1">{cnt} lượt đánh giá</div>
          <div className="mt-3 inline-flex">
            <RatingStars
              value={viewerRating ?? 0}
              onChange={onRate}
              disabled={busy || isLoading}
            />
          </div>
          {user && viewerRating != null && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="block mx-auto mt-2 text-[11px] text-cinema-400 hover:text-cinema-200 underline-offset-2 hover:underline"
            >
              Xoá đánh giá của tôi
            </button>
          )}
        </div>

        <RatingDistribution
          distribution={
            stats?.distribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          }
          count={cnt}
          onJumpTo={(s) => {
            if (s === 5) onJumpToComments?.("top");
          }}
        />
      </div>
    </section>
  );
}
