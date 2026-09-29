"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { History, Play, Trash2, X, Clock } from "lucide-react";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { useAuth } from "@/lib/auth/authContext";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AuthSyncBanner } from "@/components/home/auth-sync-banner";

export default function HistoryPage() {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const { history, isLoaded, removeFromHistory, clearHistory } = useWatchHistory();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins} phút`;
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-6 rounded-full bg-brand inline-block" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Lịch Sử Xem
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-cinema-400">
            Xem lại các bộ phim bạn đã thưởng thức và tiếp tục theo dõi tập phim dang dở
          </p>
        </div>

        {mounted && history.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            className="text-xs text-cinema-400 hover:text-red-400 hover:border-red-500/50 self-start sm:self-auto gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa lịch sử</span>
          </Button>
        )}
      </div>

      {!mounted || !isLoaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : history.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item, idx) => {
            const movie = item.movie;
            const watchUrl =
              movie.type === "series" && item.episodeNumber
                ? `/watch/${movie.slug}?episode=${item.episodeNumber}`
                : `/watch/${movie.slug}`;

            return (
              <div
                key={`${movie.id}-${item.episodeId || item.episodeNumber || "full"}-${idx}`}
                className="group relative flex rounded-2xl bg-cinema-850/80 border border-cinema-700/60 overflow-hidden hover:border-cinema-500/70 transition-all duration-300 shadow-md"
              >
                {/* Poster / Thumbnail preview */}
                <Link
                  href={watchUrl}
                  className="relative w-28 sm:w-32 aspect-poster flex-shrink-0 bg-cinema-800 overflow-hidden block"
                >
                  <Image
                    src={movie.posterUrl}
                    alt={movie.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    sizes="128px"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80";
                    }}
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-9 h-9 rounded-full bg-brand text-cinema-950 flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                  {/* Progress bar inside poster bottom */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-cinema-700">
                    <div
                      className="h-full bg-brand"
                      style={{ width: `${item.progressPercent}%` }}
                    />
                  </div>
                </Link>

                {/* Info Container */}
                <div className="p-3.5 flex flex-col justify-between flex-grow min-w-0">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <Badge variant="brand" className="text-[10px] px-1.5 py-0.5 mb-1">
                        {item.progressPercent}% Đã xem
                      </Badge>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const targetId = item.movieId || movie?.id || item.slug || movie?.slug;
                          if (targetId) removeFromHistory(targetId);
                        }}
                        title="Xóa khỏi lịch sử"
                        aria-label="Xóa khỏi lịch sử"
                        className="text-cinema-400 hover:text-red-400 hover:bg-cinema-700/50 rounded-full transition-colors p-1.5"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <Link
                      href={watchUrl}
                      className="font-semibold text-sm text-white hover:text-brand transition-colors line-clamp-1 block mt-0.5"
                    >
                      {movie.title}
                    </Link>

                    {item.episodeName && (
                      <p className="text-xs text-cinema-300 line-clamp-1 mt-0.5">
                        {item.episodeName}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-[11px] text-cinema-400 mt-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(item.progressSeconds)} / {formatTime(item.durationSeconds)}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-cinema-750 flex items-center justify-between">
                    <span className="text-[10px] text-cinema-500">
                      {new Date(item.watchedAt || Date.now()).toLocaleDateString("vi-VN")}
                    </span>

                    <Link href={watchUrl}>
                      <span className="text-xs font-semibold text-brand hover:underline flex items-center gap-1">
                        <span>Tiếp tục xem</span>
                        <Play className="w-3 h-3 fill-current" />
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !user ? (
        <EmptyState
          icon={<History className="w-8 h-8 text-[#FECF59]" />}
          title="Đăng nhập để xem lịch sử phim"
          description="Vui lòng đăng nhập tài khoản RubyFilm để theo dõi các bộ phim đã xem và tiếp tục xem dở dang của riêng bạn."
          actionText="Đăng Nhập Ngay"
          onAction={() => openAuthModal("login")}
        />
      ) : (
        <EmptyState
          icon={<History className="w-8 h-8 text-cinema-400" />}
          title="Chưa có lịch sử xem phim"
          description="Khi bạn xem phim trên RubyFilm, các tập phim và tiến trình xem dở sẽ tự động được lưu lại tại đây."
          actionText="Bắt Đầu Xem Phim"
          actionHref="/"
        />
      )}

      {/* Auth Sync Banner */}
      <div className="mt-12">
        <AuthSyncBanner />
      </div>
    </div>
  );
}
