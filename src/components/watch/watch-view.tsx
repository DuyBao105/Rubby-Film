"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Star,
  Film,
  Heart,
  Check,
  Share2,
  Info,
  ChevronRight,
  ArrowLeft,
  Home,
  Clock,
  RotateCcw,
  AlertCircle,
  X,
  Send,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Movie, Episode, VideoSource } from "@/types/movie";

const VideoPlayer = dynamic(
  () => import("./video-player").then((mod) => mod.VideoPlayer),
  {
    ssr: false,
    loading: () => (
      <div className="relative aspect-video w-full max-w-full bg-cinema-950 rounded-2xl border border-cinema-700/60 flex flex-col items-center justify-center animate-pulse shadow-2xl">
        <div className="w-12 h-12 rounded-full border-4 border-brand/20 border-t-brand animate-spin mb-3" />
        <span className="text-xs text-cinema-400 font-semibold tracking-wider uppercase">
          Đang khởi động trình phát...
        </span>
      </div>
    ),
  }
);
import { EpisodeSelector } from "./episode-selector";
import { ServerSelector } from "./server-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { useMyList } from "@/lib/hooks/use-my-list";
import { cn, formatRating } from "@/lib/utils";
import { FALLBACK_POSTER } from "@/lib/utils/image";

interface WatchViewProps {
  movie: Movie;
  relatedMovies: Movie[];
}

export function WatchView({ movie, relatedMovies }: WatchViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Support both ?episode= and ?ep= parameter
  const episodeQuery = searchParams.get("episode") || searchParams.get("ep");
  const seasonQuery = searchParams.get("season");
  const serverQuery = searchParams.get("server");

  const { history, updateProgress, getMovieProgress, getEpisodeProgress } = useWatchHistory();
  const { isInList, toggleMovie } = useMyList();

  const [copied, setCopied] = React.useState(false);
  const [autoNextEnabled, setAutoNextEnabled] = React.useState(true);
  const [resumePromptVisible, setResumePromptVisible] = React.useState(false);
  const [reportModalOpen, setReportModalOpen] = React.useState(false);
  const [reportIssue, setReportIssue] = React.useState("video_not_playing");
  const [reportDescription, setReportDescription] = React.useState("");
  const [reportSubmitted, setReportSubmitted] = React.useState(false);
  const inList = isInList(movie.id);

  // Setup episodes
  const episodes = movie.episodes || [];
  const currentEpNumber = episodeQuery ? parseInt(episodeQuery, 10) : 1;
  const currentEpisode: Episode | undefined =
    episodes.find((e) => e.episodeNumber === currentEpNumber) ||
    episodes.find((e) => e.episodeNumber === 1) ||
    episodes[0];

  // Setup sources
  const sources = React.useMemo(() => currentEpisode?.videoSources || [], [currentEpisode]);
  const [activeSourceIndex, setActiveSourceIndex] = React.useState(0);

  // Match serverQuery if provided
  React.useEffect(() => {
    if (serverQuery && sources.length > 0) {
      const foundIdx = sources.findIndex(
        (s) => s.serverName.toLowerCase() === serverQuery.toLowerCase()
      );
      if (foundIdx !== -1) {
        setActiveSourceIndex(foundIdx);
      }
    }
  }, [serverQuery, sources]);

  const activeSource: VideoSource = sources[activeSourceIndex] || {
    serverName: "Server VIP #1",
    label: "Full HD",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
    type: "mp4",
  };

  // Saved playback progress - compute reactively when history loads or episode changes
  const [initialTime, setInitialTime] = React.useState(0);
  const currentPlaybackRef = React.useRef<{ currentTime: number; duration: number } | null>(null);

  React.useEffect(() => {
    const epNum = currentEpisode?.episodeNumber ?? 1;
    const savedProgress = currentEpisode
      ? getEpisodeProgress(movie.id, epNum)
      : getMovieProgress(movie.id);

    if (
      savedProgress &&
      savedProgress.progressSeconds > 5 &&
      !savedProgress.completed
    ) {
      setInitialTime(savedProgress.progressSeconds);
      setResumePromptVisible(true);
      const timer = setTimeout(() => setResumePromptVisible(false), 9000);
      return () => clearTimeout(timer);
    } else {
      setInitialTime(0);
      setResumePromptVisible(false);
    }
  }, [currentEpisode?.id, currentEpisode?.episodeNumber, movie.id, getEpisodeProgress, getMovieProgress, history]);

  // Synchronize playback progress immediately when page is hidden or unloaded (e.g. mobile tab switch/close)
  React.useEffect(() => {
    const flushCurrentProgress = () => {
      if (currentPlaybackRef.current && currentPlaybackRef.current.duration > 0) {
        updateProgress(
          movie,
          currentPlaybackRef.current.currentTime,
          currentPlaybackRef.current.duration,
          currentEpisode
            ? {
                id: currentEpisode.id,
                episodeNumber: currentEpisode.episodeNumber,
                name: currentEpisode.name,
              }
            : undefined,
          true
        );
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushCurrentProgress();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushCurrentProgress);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushCurrentProgress);
    };
  }, [movie, currentEpisode, updateProgress]);
  // Handle episode change
  const handleSelectEpisode = (ep: Episode) => {
    setResumePromptVisible(false);
    router.push(`/watch/${movie.slug}?episode=${ep.episodeNumber}`);
  };

  // Prev / Next logic
  const currentEpIndex = episodes.findIndex((e) => e.id === currentEpisode?.id);
  const hasPrevEpisode = currentEpIndex > 0;
  const hasNextEpisode = currentEpIndex >= 0 && currentEpIndex < episodes.length - 1;

  const handlePrevEpisode = () => {
    if (hasPrevEpisode) {
      handleSelectEpisode(episodes[currentEpIndex - 1]);
    }
  };

  const handleNextEpisode = () => {
    if (hasNextEpisode) {
      handleSelectEpisode(episodes[currentEpIndex + 1]);
    }
  };

  const handleSwitchServer = () => {
    if (sources.length > 1) {
      const nextIdx = (activeSourceIndex + 1) % sources.length;
      setActiveSourceIndex(nextIdx);
    }
  };

  // Save progress throttle
  // Save progress throttle & tracking
  const lastSaveTimeRef = React.useRef(0);
  const handleTimeUpdate = (currentTime: number, duration: number) => {
    currentPlaybackRef.current = { currentTime, duration };
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 4000) {
      lastSaveTimeRef.current = now;
      updateProgress(
        movie,
        currentTime,
        duration,
        currentEpisode
          ? {
              id: currentEpisode.id,
              episodeNumber: currentEpisode.episodeNumber,
              name: currentEpisode.name,
            }
          : undefined
      );
    }
  };

  const handleVideoPause = () => {
    if (currentPlaybackRef.current && currentPlaybackRef.current.duration > 0) {
      updateProgress(
        movie,
        currentPlaybackRef.current.currentTime,
        currentPlaybackRef.current.duration,
        currentEpisode
          ? {
              id: currentEpisode.id,
              episodeNumber: currentEpisode.episodeNumber,
              name: currentEpisode.name,
            }
          : undefined,
        true
      );
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Đang xem ${movie.title} - RubbyFilm`,
          text: movie.description,
          url: window.location.href,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const [isCinemaMode, setIsCinemaMode] = React.useState(false);
  const playerWrapperRef = React.useRef<HTMLDivElement>(null);

  // When cinema mode is toggled, auto-scroll and center video player to the screen
  React.useEffect(() => {
    if (isCinemaMode && playerWrapperRef.current) {
      setTimeout(() => {
        playerWrapperRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    }
  }, [isCinemaMode]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div
      ref={playerWrapperRef}
      className={cn(
        "pb-20 mx-auto w-full transition-all duration-500",
        isCinemaMode
          ? "pt-14 max-w-[100vw] px-0 sm:px-3 md:px-6"
          : "pt-20 sm:pt-24 max-w-7xl px-4 sm:px-6 lg:px-8"
      )}
    >
      {/* Breadcrumbs - hidden during cinema mode to maximize player screen estate */}
      {/* Breadcrumbs with interactive Back button and rich navigation */}
      {!isCinemaMode && (
        <div className="flex items-center gap-1.5 text-xs text-cinema-400 mb-4 overflow-x-auto whitespace-nowrap py-1 no-scrollbar">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/20 text-cinema-200 hover:text-white text-xs font-semibold transition-all mr-1 active:scale-95 group/back cursor-pointer flex-shrink-0"
            title="Quay lại trang trước"
            aria-label="Quay lại trang trước"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover/back:-translate-x-0.5" />
            <span>Quay lại</span>
          </button>

          <span className="w-[1px] h-3.5 bg-white/15 mx-1 flex-shrink-0" />

          {/* Home Link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:text-white transition-colors py-0.5 px-1 rounded hover:bg-white/5 flex-shrink-0"
          >
            <Home className="w-3.5 h-3.5 text-cinema-400" />
            <span>Trang chủ</span>
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-cinema-600 flex-shrink-0" />

          {/* Type Link */}
          <Link
            href={movie.type === "series" ? "/series" : "/movies?type=single"}
            className="hover:text-white transition-colors py-0.5 px-1 rounded hover:bg-white/5 flex-shrink-0 font-medium"
          >
            {movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-cinema-600 flex-shrink-0" />

          {/* Movie Details Link */}
          <Link
            href={`/movie/${movie.slug}`}
            className="hover:text-[#E50000] font-semibold text-cinema-200 transition-colors max-w-[180px] sm:max-w-[280px] truncate py-0.5 px-1 rounded hover:bg-white/5 flex-shrink-0"
            title={movie.title}
          >
            {movie.title}
          </Link>

          {/* Episode indicator for series */}
          {movie.type === "series" && currentEpisode && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-cinema-600 flex-shrink-0" />
              <span className="px-2 py-0.5 rounded-md bg-[#E50000]/15 text-[#E50000] font-bold border border-[#E50000]/30 text-[11px] flex-shrink-0">
                Tập {currentEpisode.episodeNumber}
              </span>
            </>
          )}
        </div>
      )}

      {/* Video Player Container */}
      <div className="space-y-4">
        <div className="relative">
          <VideoPlayer
            key={`${movie.id}-${currentEpisode?.id || 1}-${activeSource.url}`}
            source={activeSource}
            title={movie.title}
            subtitle={
              movie.type === "series" && currentEpisode
                ? `${currentEpisode.name} (${currentEpisode.duration || "HD"})`
                : movie.quality
            }
            posterUrl={movie.backdropUrl || movie.posterUrl}
            onTimeUpdate={handleTimeUpdate}
            onPause={handleVideoPause}
            initialTime={initialTime}
            onEnded={hasNextEpisode ? handleNextEpisode : undefined}
            hasNextEpisode={hasNextEpisode}
            onNextEpisode={handleNextEpisode}
            hasPrevEpisode={hasPrevEpisode}
            onPrevEpisode={handlePrevEpisode}
            autoNextEnabled={autoNextEnabled}
            onSwitchServer={sources.length > 1 ? handleSwitchServer : undefined}
            isCinemaMode={isCinemaMode}
            onToggleCinemaMode={() => setIsCinemaMode(!isCinemaMode)}
          />

          {/* Resume Playback Prompt Banner */}
          {resumePromptVisible && initialTime > 0 && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 z-20 flex items-center justify-between gap-3 p-3 bg-cinema-900/95 border border-brand/40 rounded-xl shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="w-4 h-4 text-brand flex-shrink-0" />
                <span className="text-white">
                  Đang phát tiếp từ <strong>{formatSeconds(initialTime)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setInitialTime(0);
                    setResumePromptVisible(false);
                  }}
                  className="text-[11px] text-cinema-300 hover:text-white flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cinema-800 hover:bg-cinema-700 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Xem từ đầu</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResumePromptVisible(false)}
                  className="p-1.5 text-cinema-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  aria-label="Đóng thông báo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Server Selector & Quick Episode Navigation Toolbar */}
        {sources.length > 0 && (
          <ServerSelector
            sources={sources}
            activeSource={activeSource}
            onSelectSource={(src) => {
              const idx = sources.findIndex((s) => s.serverName === src.serverName);
              if (idx !== -1) setActiveSourceIndex(idx);
            }}
            hasPrevEpisode={hasPrevEpisode}
            hasNextEpisode={hasNextEpisode}
            onPrevEpisode={handlePrevEpisode}
            onNextEpisode={handleNextEpisode}
            autoNextEnabled={autoNextEnabled}
            onToggleAutoNext={() => setAutoNextEnabled(!autoNextEnabled)}
          />
        )}
      </div>

      {/* Movie Details & Episodes Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
        {/* Left Column: Movie Info & Actions */}
        <div className="lg:col-span-8 space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="rating" className="text-xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-1" />
                <span className="font-bold">{formatRating(movie.rating)}</span>
              </Badge>
              <Badge variant="brand">{movie.quality || "HD"}</Badge>
              <Badge variant="secondary">{movie.language || "Vietsub"}</Badge>
              <span className="text-xs text-cinema-400">{movie.year}</span>
              <span className="text-xs text-cinema-400">•</span>
              <span className="text-xs text-cinema-400">{movie.duration}</span>
              <span className="text-xs text-cinema-400">•</span>
              <Link
                href={`/country/${movie.countrySlug || "quoc-te"}`}
                className="text-xs text-cinema-400 hover:text-white transition-colors"
              >
                {movie.country}
              </Link>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
              {movie.title}
              {movie.type === "series" && currentEpisode && (
                <span className="text-brand font-semibold ml-2 text-xl sm:text-2xl">
                  - Tập {currentEpisode.episodeNumber}
                </span>
              )}
            </h1>
            <p className="text-sm text-[#9CA3AF] italic mt-0.5">
              {movie.originalTitle || movie.title}
            </p>
          </div>

          {/* Quick Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => toggleMovie(movie)}
              className="gap-2 text-xs sm:text-sm h-10 border border-cinema-700 transition-all hover:scale-105 active:scale-95"
            >
              {inList ? (
                <>
                  <Heart className="w-4 h-4 fill-brand text-brand animate-pulse" />
                  <span>Đã Thêm Yêu Thích</span>
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 text-white" />
                  <span>Yêu Thích</span>
                </>
              )}
            </Button>

            <Link href={`/movie/${movie.slug}`}>
              <Button variant="outline" className="gap-2 text-xs sm:text-sm h-10 border-cinema-700">
                <Info className="w-4 h-4" />
                <span>Chi Tiết Phim</span>
              </Button>
            </Link>

            <Button
              variant="ghost"
              onClick={handleShare}
              className="gap-2 text-xs sm:text-sm h-10 hover:bg-cinema-800 text-cinema-300"
            >
              <Share2 className="w-4 h-4" />
              <span>{copied ? "Đã chép link!" : "Chia sẻ"}</span>
            </Button>

            <Button
              variant="ghost"
              onClick={() => {
                setReportModalOpen(true);
                setReportSubmitted(false);
              }}
              className="gap-2 text-xs sm:text-sm h-10 hover:bg-cinema-800 text-cinema-400 hover:text-amber-400 transition-colors"
            >
              <AlertCircle className="w-4 h-4" />
              <span>Báo Lỗi</span>
            </Button>
          </div>

          {/* Synopsis */}
          <div className="p-5 rounded-2xl bg-cinema-850/60 border border-cinema-700/60">
            <h3 className="text-sm font-semibold text-[#F9FAFB] tracking-[-0.02em] uppercase mb-2 flex items-center gap-2">
              <Film className="w-4 h-4 text-brand" />
              <span>Tóm tắt nội dung</span>
            </h3>
            <p className="text-sm text-[#D1D5DB] font-normal leading-[1.6]">
              {movie.description || "Nội dung phim đang được cập nhật."}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-cinema-750 text-xs">
              <div>
                <span className="text-[#9CA3AF]">Đạo diễn: </span>
                {movie.director && movie.director.trim() !== "" ? (
                  movie.director.split(",").map((dir, idx, arr) => {
                    const d = dir.trim();
                    return (
                      <React.Fragment key={d}>
                        <Link
                          href={`/search?director=${encodeURIComponent(d)}`}
                          className="text-[#F9FAFB] hover:text-brand font-medium hover:underline transition-colors"
                          title={`Xem phim của đạo diễn ${d}`}
                        >
                          {d}
                        </Link>
                        {idx < arr.length - 1 && <span className="text-cinema-500">, </span>}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <span className="text-[#F9FAFB] font-medium">Đang cập nhật</span>
                )}
              </div>
              <div>
                <span className="text-[#9CA3AF]">Diễn viên: </span>
                {movie.cast && movie.cast.length > 0 ? (
                  movie.cast.map((actor, idx, arr) => {
                    const a = actor.trim();
                    if (!a) return null;
                    return (
                      <React.Fragment key={a}>
                        <Link
                          href={`/search?actor=${encodeURIComponent(a)}`}
                          className="text-[#F9FAFB] hover:text-brand font-medium hover:underline transition-colors"
                          title={`Xem phim có sự tham gia của ${a}`}
                        >
                          {a}
                        </Link>
                        {idx < arr.length - 1 && <span className="text-cinema-500">, </span>}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <span className="text-[#F9FAFB] font-medium">Đang cập nhật</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Episode Selector & Related */}
        <div className="lg:col-span-4 space-y-6">
          {movie.type === "series" && episodes.length > 0 && (
            <EpisodeSelector
              movieId={movie.id}
              episodes={episodes}
              activeEpisodeId={currentEpisode?.id || ""}
              onSelectEpisode={handleSelectEpisode}
            />
          )}

          {/* Recommended Side Box */}
          {relatedMovies.length > 0 && (
            <div className="p-5 rounded-2xl bg-cinema-850/60 border border-cinema-700/60">
              <h3 className="text-sm font-extrabold text-[#F9FAFB] tracking-[-0.02em] mb-4">Gợi Ý Xem Tiếp</h3>
              <div className="space-y-3">
                {relatedMovies.slice(0, 4).map((rel) => (
                  <Link
                    key={rel.id}
                    href={`/watch/${rel.slug}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-cinema-800 transition-colors group"
                  >
                    <div className="relative w-14 aspect-poster rounded-lg overflow-hidden bg-cinema-800 flex-shrink-0">
                      <Image
                        src={rel.posterUrl || FALLBACK_POSTER}
                        alt={rel.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform"
                        sizes="56px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs font-extrabold text-[#F9FAFB] tracking-[-0.02em] group-hover:text-brand transition-colors line-clamp-1">
                        {rel.title}
                      </h4>
                      <p className="text-[11px] font-medium text-[#9CA3AF] mt-0.5 line-clamp-1">
                        {rel.year} • {rel.quality || "HD"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Broken Video Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-cinema-900 border border-cinema-700 shadow-2xl p-6 text-left">
            <button
              type="button"
              onClick={() => setReportModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-cinema-400 hover:text-white hover:bg-cinema-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5 text-amber-400" />
              <span>Báo Cáo Sự Cố Video</span>
            </h3>
            <p className="text-xs text-cinema-400 mb-4">
              Phim: <strong>{movie.title}</strong>
              {currentEpisode ? ` (Tập ${currentEpisode.episodeNumber})` : ""}
            </p>

            {reportSubmitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="text-sm font-bold text-white">Đã gửi báo cáo thành công!</h4>
                <p className="text-xs text-cinema-300 max-w-xs mx-auto">
                  Cảm ơn bạn! Đội ngũ kỹ thuật của RubbyFilm đã ghi nhận và sẽ kiểm tra khắc phục nguồn phát sớm nhất.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setReportModalOpen(false)}
                  className="mt-2 text-xs font-bold"
                >
                  Đóng
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setReportSubmitted(true);
                }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-cinema-300 block mb-1.5">
                    Loại sự cố bạn gặp phải:
                  </label>
                  <select
                    value={reportIssue}
                    onChange={(e) => setReportIssue(e.target.value)}
                    className="w-full bg-cinema-800 border border-cinema-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand"
                  >
                    <option value="video_not_playing">Video không tải được / màn hình đen</option>
                    <option value="wrong_episode">Sai tập / video bị trùng lặp</option>
                    <option value="wrong_subtitle">Lỗi phụ đề / không khớp tiếng</option>
                    <option value="wrong_info">Sai thông tin phim / hình ảnh</option>
                    <option value="audio_error">Mất tiếng / âm thanh rè</option>
                    <option value="other">Sự cố khác</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-cinema-300 block mb-1.5">
                    Mô tả chi tiết (tùy chọn):
                  </label>
                  <textarea
                    rows={3}
                    value={reportDescription}
                    onChange={(e) => setReportDescription(e.target.value)}
                    placeholder="Mô tả cụ thể phút bị lỗi hoặc triệu chứng..."
                    className="w-full bg-cinema-800 border border-cinema-700 rounded-xl p-3 text-xs text-white placeholder-cinema-500 focus:outline-none focus:border-brand resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReportModalOpen(false)}
                    className="text-xs"
                  >
                    Hủy
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="text-xs font-bold gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Gửi báo cáo</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
