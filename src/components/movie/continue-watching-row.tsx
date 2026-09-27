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
        history.map((item) => [`${item.movieId || item.movie?.id}-${item.episodeNumber || 1}`, item])
      ).values()
    )
      .filter((item) => item.progressSeconds > 5 && !item.completed)
      .slice(0, 10);
  }, [history]);

  // Strictly hidden for unauthenticated users or when in-progress items are empty
  if (!isAuthenticated || !user || !isLoaded || continueItems.length === 0) {
    return null;
  }

  const formatSeconds = (sec: number) => {
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
          className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
        >
          <span>Xem tất cả</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="flex items-stretch gap-4 overflow-x-auto pb-3 pt-1 scrollbar-none scroll-smooth">
        {continueItems.map((item, idx) => {
            const movie = item.movie;
            const targetUrl =
              movie.type === "series" && item.episodeNumber
                ? `/watch/${movie.slug}?episode=${item.episodeNumber}`
                : `/watch/${movie.slug}`;

            return (
              <div
                key={`${movie.id}-${item.episodeNumber || 1}-${idx}`}
                className="flex-shrink-0 w-64 sm:w-72 rounded-2xl bg-cinema-850/90 border border-cinema-700/80 overflow-hidden group hover:border-brand/50 transition-all duration-300 shadow-lg relative flex flex-col justify-between"
              >
              {/* Media Thumbnail Container */}
              <div className="relative aspect-video w-full bg-cinema-800 overflow-hidden">
                <Image
                  src={movie.backdropUrl || movie.posterUrl || FALLBACK_POSTER}
                  alt={movie.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                  sizes="288px"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = FALLBACK_POSTER;
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-cinema-900 via-transparent to-black/40" />

                {/* Remove button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const targetId = item.movieId || movie?.id || item.slug || movie?.slug;
                    if (targetId) {
                      removeFromHistory(targetId);
                    }
                  }}
                  title="Xóa khỏi tiếp tục xem"
                  aria-label="Xóa khỏi danh sách tiếp tục xem"
                  className="absolute top-2 right-2 z-30 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-cinema-950/80 hover:bg-red-600 text-cinema-200 hover:text-white transition-all flex items-center justify-center shadow-lg border border-cinema-700/80 hover:border-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Center Quick Play overlay */}
                <Link
                  href={targetUrl}
                  className="absolute inset-0 flex items-center justify-center z-10"
                >
                  <div className="w-12 h-12 rounded-full bg-brand/90 group-hover:bg-brand text-cinema-950 flex items-center justify-center shadow-xl shadow-brand/20 transition-transform group-hover:scale-110">
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </div>
                </Link>

                {/* Progress bar at bottom of thumbnail */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-cinema-700">
                  <div
                    className="h-full bg-brand"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Title & Info */}
              <div className="p-3">
                <Link href={targetUrl} className="block">
                  <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-brand transition-colors truncate">
                    {movie.title}
                  </h3>
                </Link>
                <div className="flex items-center justify-between mt-1 text-[11px] text-cinema-400">
                  <span>
                    {item.episodeName || (item.episodeNumber ? `Tập ${item.episodeNumber}` : "Bản Full")}
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
