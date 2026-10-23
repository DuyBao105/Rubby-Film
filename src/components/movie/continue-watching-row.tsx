"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Clock, X, ChevronRight } from "lucide-react";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { useAuth } from "@/lib/auth/authContext";
import { FALLBACK_POSTER } from "@/lib/utils/image";

export function ContinueWatchingRow() {
  const { user, isAuthenticated } = useAuth();
  const { history, isLoaded, removeFromHistory } = useWatchHistory();

  const continueItems = React.useMemo(() => {
    return Array.from(
      new Map(
        history.map((item) => [`${item.movieId || item.movie?.id || item.slug}-${item.episodeNumber || 1}`, item])
      ).values()
    )
      .filter((item) => item.progressSeconds > 0 && !item.completed)
      .slice(0, 10);
  }, [history]);

  // Strictly hidden for unauthenticated users or when in-progress items are empty
  if (!isAuthenticated || !user || !isLoaded || continueItems.length === 0) {
    return null;
  }

  const formatSeconds = (sec: number) => {
    if (sec < 60) {
      return `${Math.max(1, Math.round(sec))}s`;
    }
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}p`;
    }
    return `${mins} phút`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-brand inline-block" />
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Tiếp Tục Xem
          </h2>
          <span className="text-xs text-cinema-400 bg-cinema-800 px-2 py-0.5 rounded-full border border-cinema-700">
            {continueItems.length}
          </span>
        </div>

        <Link
          href="/history"
          prefetch={true}
          className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
        >
          <span>Xem tất cả</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div
        className="flex items-stretch gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none scroll-smooth snap-x snap-mandatory touch-pan-x"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {continueItems.map((item, idx) => {
          const movie = item.movie || {
            id: item.movieId,
            slug: item.slug,
            title: item.title,
            posterUrl: item.posterUrl,
            backdropUrl: item.backdropUrl,
            type: item.episodeNumber ? "series" : "single",
          };
          const slug = movie.slug || item.slug;
          const movieTitle = movie.title || item.title || "Phim";
          const imageSrc =
            movie.backdropUrl ||
            movie.posterUrl ||
            item.backdropUrl ||
            item.posterUrl ||
            FALLBACK_POSTER;

          const isSeries =
            movie.type === "series" ||
            (item.episodeNumber !== undefined && item.episodeNumber > 0);
          const targetUrl =
            isSeries && item.episodeNumber
              ? `/watch/${slug}?episode=${item.episodeNumber}`
              : `/watch/${slug}`;

          const progressPercent = Math.min(
            100,
            Math.max(
              0,
              item.progressPercent ||
                (item.durationSeconds > 0
                  ? Math.round((item.progressSeconds / item.durationSeconds) * 100)
                  : 0)
            )
          );

          return (
            <div
              key={`${item.movieId || movie.id || slug}-${item.episodeNumber || 1}-${idx}`}
              className="group flex-shrink-0 w-52 sm:w-72 rounded-2xl bg-cinema-850/90 border border-cinema-700/80 overflow-hidden hover:border-brand/70 hover:shadow-brand/20 transition-all duration-300 shadow-lg relative flex flex-col justify-between cursor-pointer snap-start"
            >
              {/* Full-card link for frictionless navigation */}
              <Link
                href={targetUrl}
                prefetch={true}
                className="absolute inset-0 z-10 cursor-pointer"
                aria-label={`Xem tiếp ${movieTitle}`}
              />

              {/* Media Thumbnail Container */}
              <div className="relative aspect-video w-full bg-cinema-800 overflow-hidden pointer-events-none">
                <Image
                  src={imageSrc}
                  alt={movieTitle}
                  fill
                  unoptimized={true}
                  className="object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                  sizes="288px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-cinema-900 via-transparent to-black/40" />

                {/* Center Quick Play icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-brand group-hover:bg-brand-hover text-white flex items-center justify-center shadow-xl shadow-brand/40 transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </div>

                {/* Progress bar at bottom of thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cinema-700/80">
                  <div
                    className="h-full bg-brand transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Remove button (z-20 with stop propagation) */}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const targetId =
                    item.movieId || movie?.id || item.slug || movie?.slug;
                  if (targetId) {
                    removeFromHistory(targetId);
                  }
                }}
                title="Xóa khỏi tiếp tục xem"
                aria-label="Xóa khỏi danh sách tiếp tục xem"
                className="absolute top-2 right-2 z-20 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cinema-950/80 hover:bg-red-600 text-cinema-200 hover:text-white transition-all flex items-center justify-center shadow-lg border border-cinema-700/80 hover:border-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title & Info */}
              <div className="p-3 pointer-events-none">
                <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand transition-colors truncate">
                  {movieTitle}
                </h3>
                <div className="flex items-center justify-between mt-1 text-[11px] text-cinema-400">
                  <span>
                    {item.episodeName ||
                      (item.episodeNumber ? `Tập ${item.episodeNumber}` : "Bản Full")}
                  </span>
                  <div className="flex items-center gap-1 text-cinema-300">
                    <Clock className="w-3 h-3 text-brand" />
                    <span>{formatSeconds(item.progressSeconds)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
