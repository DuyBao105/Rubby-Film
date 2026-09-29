"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Play,
  Heart,
  Share2,
  Star,
  Clock,
  Calendar,
  Globe2,
  Film,
  Layers,
  User,
  Tv,
  CheckCircle2,
  ArrowLeft,
  Home,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  MessageCircle,
  Server,
  Bell,
  Search,
  Lock,
  Sparkles,
} from "lucide-react";
import { Movie, Episode } from "@/types/movie";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { formatRating } from "@/lib/utils";
import { FALLBACK_POSTER, FALLBACK_BACKDROP } from "@/lib/utils/image";
import { MovieGrid } from "./movie-grid";
import { RatingSkeleton } from "@/components/community/rating/rating-skeleton";
import { CommentSkeleton } from "@/components/community/comments/comment-skeleton";
import { AiringScheduleBanner } from "@/components/watch/airing-schedule-banner";
import { getAiringSchedule, getTimeRemaining, toggleEpisodeReminder, isEpisodeReminderSet } from "@/lib/utils/airingSchedule";
import { useToast } from "@/components/ui/toast";

// Community island sections — bypass SSR to keep Drizzle/Postgres out of RSC bundle.
const RatingSection = dynamic(
  () => import("@/components/community/rating/rating-section").then((m) => m.RatingSection),
  { ssr: false, loading: () => <RatingSkeleton /> },
);
const CommentSection = dynamic(
  () => import("@/components/community/comments/comment-section").then((m) => m.CommentSection),
  { ssr: false, loading: () => <CommentSkeleton /> },
);

interface MovieDetailProps {
  movie: Movie;
  relatedMovies: Movie[];
}

export function MovieDetail({ movie, relatedMovies }: MovieDetailProps) {
  const router = useRouter();
  const toast = useToast();
  const { isInList, toggleMovie } = useMyList();
  const { getMovieProgress, isEpisodeWatched, getEpisodeProgress } = useWatchHistory();
  const [copied, setCopied] = React.useState(false);
  const [posterSrc, setPosterSrc] = React.useState(movie.posterUrl || FALLBACK_POSTER);
  const [backdropSrc, setBackdropSrc] = React.useState(movie.backdropUrl || FALLBACK_BACKDROP);
  const [selectedSeason, setSelectedSeason] = React.useState(1);
  const [activeTab, setActiveTab] = React.useState<"episodes" | "cast">(() =>
    movie.episodes && movie.episodes.length > 0 ? "episodes" : "cast"
  );
  const [isTrailerOpen, setIsTrailerOpen] = React.useState(false);
  const [isDescExpanded, setIsDescExpanded] = React.useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = React.useState(false);
  const [selectedServer, setSelectedServer] = React.useState<number>(0);
  const [selectedUpcomingEp, setSelectedUpcomingEp] = React.useState<number | null>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  React.useEffect(() => {
    setPosterSrc(movie.posterUrl || FALLBACK_POSTER);
    setBackdropSrc(movie.backdropUrl || FALLBACK_BACKDROP);
  }, [movie.posterUrl, movie.backdropUrl]);

  const inList = isMounted ? isInList(movie.id) : false;
  const savedProgress = isMounted ? getMovieProgress(movie.id) : null;
  const episodes = React.useMemo(() => movie.episodes || [], [movie.episodes]);

  // Group episodes into seasons or chunks if large series
  const seasonGroups = React.useMemo(() => {
    if (episodes.length === 0) return [];
    const seasonMap = new Map<number, Episode[]>();
    episodes.forEach((ep) => {
      const s = ep.seasonNumber || 1;
      if (!seasonMap.has(s)) seasonMap.set(s, []);
      seasonMap.get(s)!.push(ep);
    });

    if (seasonMap.size > 1) {
      return Array.from(seasonMap.entries()).map(([seasonNum, eps]) => ({
        id: seasonNum,
        name: `Mùa ${seasonNum}`,
        episodes: eps,
      }));
    }

    if (episodes.length > 40) {
      const chunkSize = 30;
      const chunks = [];
      for (let i = 0; i < episodes.length; i += chunkSize) {
        const chunkEps = episodes.slice(i, i + chunkSize);
        const startEp = chunkEps[0].episodeNumber;
        const endEp = chunkEps[chunkEps.length - 1].episodeNumber;
        chunks.push({
          id: Math.floor(i / chunkSize) + 1,
          name: `Tập ${startEp} - ${endEp}`,
          episodes: chunkEps,
        });
      }
      return chunks;
    }

    return [
      {
        id: 1,
        name: "Mùa 1",
        episodes: episodes,
      },
    ];
  }, [episodes]);

  const currentSeasonEpisodes =
    seasonGroups.find((g) => g.id === selectedSeason)?.episodes || episodes;

  const filteredEpisodes = currentSeasonEpisodes;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${movie.title} - RubyFilm`,
          text: movie.description,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Đã sao chép link", "Bạn có thể gửi liên kết phim cho bạn bè");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Determine watch button target URL & label
  const hasSavedProgress =
    savedProgress && savedProgress.progressSeconds > 5 && !savedProgress.completed;
  const watchUrl = savedProgress?.episodeNumber
    ? `/watch/${movie.slug}?episode=${savedProgress.episodeNumber}`
    : `/watch/${movie.slug}`;

  const watchButtonText = hasSavedProgress
    ? savedProgress.episodeNumber
      ? `Tiếp Tục Xem (Tập ${savedProgress.episodeNumber})`
      : "Tiếp Tục Xem"
    : "Xem Ngay";

  // Airing schedule info
  const scheduleInfo = React.useMemo(() => {
    return getAiringSchedule({
      id: movie.id,
      slug: movie.slug,
      title: movie.title,
      type: movie.type,
      totalEpisodes: movie.totalEpisodes,
      currentEpisode: movie.currentEpisode,
      episodes,
      showtimes: movie.showtimes,
      notify: movie.notify,
    });
  }, [movie, episodes]);

  // YouTube trailer embed URL parser
  const trailerEmbedUrl = React.useMemo(() => {
    if (!movie.trailerUrl) return null;
    const url = movie.trailerUrl.trim();
    const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]+)/);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
    }
    return url;
  }, [movie.trailerUrl]);

  // Format ratings
  const tmdbScore = movie.tmdbVoteAverage || (movie.rating ? Math.round(movie.rating * 10) / 10 : 8.5);
  const imdbScore = movie.imdbVoteAverage;

  return (
    <div className="min-h-screen bg-[#0F111A] text-white pb-24 relative overflow-x-hidden">
      {/* 1. Backdrop Hero Banner (TopHim Dual Layer Effect with Blur & Radial Mask) */}
      <div className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] lg:h-[480px] overflow-hidden bg-[#0F111A]">
        {/* Layer 1: High-res Cover Image */}
        <Image
          src={backdropSrc}
          alt={movie.title}
          fill
          priority
          unoptimized={true}
          className="object-cover object-center scale-105 opacity-70 md:opacity-80"
          sizes="100vw"
          onError={() => setBackdropSrc(FALLBACK_BACKDROP)}
        />

        {/* Layer 2: Blurred Atmosphere Edge with Radial Mask */}
        <div
          className="absolute inset-0 pointer-events-none hidden md:block"
          style={{
            maskImage: "radial-gradient(transparent 60%, black 100%)",
            WebkitMaskImage: "radial-gradient(transparent 60%, black 100%)",
          }}
        >
          <Image
            src={backdropSrc}
            alt=""
            fill
            unoptimized={true}
            className="object-cover object-center blur-md scale-110 opacity-80"
            sizes="100vw"
          />
        </div>

        {/* Layer 3: Cinema Grain Pattern */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20 md:opacity-30"
          style={{
            backgroundImage: "radial-gradient(rgba(0, 0, 0, 0.8) 0.3px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        {/* Layer 4: Multi-direction Gradients blending into background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F111A] via-[#0F111A]/50 to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0F111A]/90 via-[#0F111A]/40 to-transparent w-full lg:w-3/4 pointer-events-none" />
        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-[#0F111A] to-transparent pointer-events-none" />
      </div>

      {/* 2. Main Content Container with Balanced Spacing */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 -mt-52 sm:-mt-64 md:-mt-76 lg:-mt-84 relative z-10">
        {/* Breadcrumb Navigation - Cleanly positioned above movie details */}
        <div className="mb-4 sm:mb-6 flex items-center gap-1.5 text-xs text-zinc-300 w-fit backdrop-blur-md bg-black/60 px-3.5 py-1.5 rounded-full border border-white/10 shadow-lg">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-white hover:text-red-400 transition-colors cursor-pointer"
            title="Quay lại"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quay lại</span>
          </button>
          <span className="text-white/30">•</span>
          <Link href="/" className="hover:text-red-400 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" />
            <span>Trang chủ</span>
          </Link>
          <ChevronRight className="w-3 h-3 text-white/30" />
          <Link
            href={movie.type === "series" ? "/series" : "/movies?type=single"}
            className="hover:text-red-400 transition-colors"
          >
            {movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}
          </Link>
        </div>

        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          
          {/* LEFT COLUMN: Poster + Synopsis (Desktop) */}
          <div className="shrink-0 w-44 sm:w-56 md:w-64 max-w-[280px] mx-auto md:mx-0 flex flex-col gap-6">
            {/* Poster Card */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/15 bg-[#16161E] w-full aspect-[2/3] flex items-center justify-center group">
              {/* Film icon placeholder background */}
              <Film className="absolute w-14 h-14 text-white/10" />
              <Image
                src={posterSrc}
                alt={movie.title}
                fill
                priority
                unoptimized={true}
                className="w-full h-full object-cover relative z-10 transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 240px, 320px"
                onError={() => setPosterSrc(FALLBACK_POSTER)}
              />

              {/* Star Rating Badge */}
              <div className="absolute top-2.5 left-2.5 z-20">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-amber-500/30 text-amber-400 font-bold text-xs shadow-lg">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{formatRating(movie.rating)}</span>
                </div>
              </div>

              {/* Quality Badge - RubbyFilm Signature Red */}
              {movie.quality && (
                <div className="absolute top-2.5 right-2.5 z-20">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-md">
                    {movie.quality}
                  </span>
                </div>
              )}
            </div>

            {/* Synopsis under Poster (Desktop View) */}
            <div className="hidden md:block bg-[#161824]/80 border border-white/[0.08] rounded-2xl p-4 shadow-lg">
              <h3 className="text-[15px] font-bold text-white mb-2.5 flex items-center gap-2">
                <Film className="w-4 h-4 text-brand" />
                <span>Nội dung phim</span>
              </h3>
              <div className="relative text-xs sm:text-sm text-zinc-300 leading-relaxed">
                <p className={isDescExpanded ? "" : "line-clamp-4"}>
                  {movie.description || "Nội dung phim đang được cập nhật."}
                </p>
                {movie.description && movie.description.length > 180 && (
                  <button
                    type="button"
                    onClick={() => setIsDescExpanded(!isDescExpanded)}
                    className="mt-2 text-xs font-bold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{isDescExpanded ? "Thu gọn ▴" : "Xem thêm ▾"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Details, Badges, Table, Action Buttons, Banner */}
          <div className="flex-1 md:pt-10 min-w-0 w-full">
            {/* Title & Subtitle */}
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white mb-1.5 text-center md:text-left leading-tight drop-shadow-md">
              {movie.title}
            </h1>
            <p className="text-sm md:text-base text-zinc-400 mb-4 text-center md:text-left italic font-medium">
              {movie.originalTitle || movie.title}
            </p>

            {/* Badges Row - Synchronized with RubbyFilm Brand Colors */}
            <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start mb-5 text-[11px] md:text-xs">
              {/* RubbyFilm Brand Red FHD badge */}
              <span className="inline-flex items-center justify-center rounded-[4px] text-white font-black leading-none tracking-normal h-[22px] px-2.5 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 shadow-sm">
                {movie.quality || "FHD"}
              </span>

              {/* Vietsub / Voice glass badge */}
              <span className="px-2.5 py-[3px] rounded-[4px] border border-white/20 bg-black/40 backdrop-blur-sm font-semibold text-white/90">
                {movie.language || "Vietsub"}
              </span>

              {/* Episode count status badge */}
              {movie.currentEpisode && (
                <span className="px-2.5 py-[3px] rounded-[4px] border border-red-500/30 bg-red-500/10 font-semibold text-red-400">
                  {movie.currentEpisode}
                </span>
              )}

              {/* Official TMDb Score Pill */}
              <div className="flex items-center text-[11px] font-bold rounded overflow-hidden border border-solid border-[rgba(1,180,228,0.5)]">
                <span className="bg-[#01B4E4] text-white px-2 py-0.5">TMDb</span>
                <span className="bg-[rgba(1,180,228,0.15)] text-white px-2 py-0.5">{tmdbScore}</span>
              </div>

              {/* IMDb Score Pill if available */}
              {imdbScore && (
                <div className="flex items-center text-[11px] font-bold rounded overflow-hidden border border-solid border-amber-500/50">
                  <span className="bg-amber-400 text-black px-1.5 py-0.5">IMDb</span>
                  <span className="bg-amber-400/15 text-amber-300 px-2 py-0.5">{imdbScore}</span>
                </div>
              )}
            </div>

            {/* Metadata Table Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm mb-6 hidden md:grid bg-[#161824]/50 border border-white/[0.06] rounded-xl p-4">
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Trạng thái:</span>
                <span className="text-zinc-200 font-medium">
                  {movie.type === "series"
                    ? `Đã chiếu: ${episodes.length} / ${movie.totalEpisodes || scheduleInfo?.totalEpisodes || episodes.length} tập`
                    : "Hoàn tất"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Loại phim:</span>
                <span className="text-zinc-200 font-medium">
                  {movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Năm:</span>
                <span className="text-zinc-200 font-medium">{movie.year || "2026"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Thời lượng:</span>
                <span className="text-zinc-200 font-medium">{movie.duration || "Đang cập nhật"}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Thể loại:</span>
                <div className="flex flex-wrap gap-1 text-zinc-200">
                  {movie.genres && movie.genres.length > 0 ? (
                    movie.genres.map((g, idx) => (
                      <Link
                        key={g}
                        href={`/genre/${movie.genreSlugs?.[idx] || g.toLowerCase()}`}
                        className="text-red-400 hover:text-white transition-colors underline-offset-2 hover:underline mr-1 font-medium"
                      >
                        {g}
                        {idx < movie.genres.length - 1 ? "," : ""}
                      </Link>
                    ))
                  ) : (
                    <span>Đang cập nhật</span>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-zinc-500 shrink-0 w-24">Quốc gia:</span>
                <Link
                  href={`/country/${movie.countrySlug || "quoc-te"}`}
                  className="text-red-400 hover:text-white transition-colors underline-offset-2 hover:underline font-medium"
                >
                  {movie.country || "Quốc tế"}
                </Link>
              </div>
              <div className="flex items-start gap-2 sm:col-span-2">
                <span className="text-zinc-500 shrink-0 w-24">Đạo diễn:</span>
                <span className="text-zinc-200 font-medium">
                  {movie.director ? (
                    <Link
                      href={`/search?director=${encodeURIComponent(movie.director)}`}
                      className="text-zinc-300 hover:text-red-400 transition-colors"
                    >
                      {movie.director}
                    </Link>
                  ) : (
                    "Đang cập nhật"
                  )}
                </span>
              </div>
            </div>

            {/* ACTION CTA BUTTONS BAR - Synchronized with RubbyFilm Signature Red */}
            <div className="flex flex-col md:flex-row justify-center md:justify-start items-center gap-3 mb-6 w-full">
              {/* Main "Xem Ngay" CTA Button - RubbyFilm Signature Red Gradient */}
              <Link
                href={watchUrl}
                prefetch={true}
                className="inline-flex justify-center items-center gap-2.5 px-7 md:px-9 py-3.5 text-white text-[15px] md:text-base font-extrabold rounded-full transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-600/30 hover:shadow-red-600/50 w-[90%] max-w-[340px] md:max-w-none md:w-auto min-w-[160px] cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #E50000 0%, #FF2626 50%, #C40000 100%)",
                }}
              >
                <Play className="w-5 h-5 fill-white text-white shrink-0" />
                <span>{watchButtonText}</span>
              </Link>

              {/* Trailer Button - Clean without icon as requested */}
              {movie.trailerUrl && (
                <button
                  type="button"
                  onClick={() => setIsTrailerOpen(true)}
                  className="inline-flex justify-center items-center px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white text-[14px] md:text-[15px] font-semibold rounded-full transition-colors w-[90%] max-w-[340px] md:max-w-none md:w-auto min-w-[120px] border border-white/10 cursor-pointer active:scale-95"
                >
                  Trailer
                </button>
              )}

              {/* Divider line for desktop */}
              <div className="hidden md:block w-px h-8 bg-white/15 mx-2" />

              {/* Action Buttons: Yêu thích, Chia sẻ, Bình luận */}
              <div className="flex items-center gap-4 sm:gap-6 justify-center pt-2 md:pt-0">
                {/* Yêu thích */}
                <button
                  type="button"
                  onClick={() => toggleMovie(movie)}
                  className="group flex flex-col items-center justify-center gap-1 transition-all hover:-translate-y-0.5 active:scale-95 px-2 cursor-pointer"
                  title="Yêu thích"
                >
                  <Heart
                    className={`w-6 h-6 transition-all duration-300 ${
                      inList
                        ? "fill-red-500 text-red-500 scale-110"
                        : "text-white/80 group-hover:text-red-400 group-hover:scale-110"
                    }`}
                  />
                  <span className="text-[12px] font-medium text-white/80 group-hover:text-white transition-colors">
                    {inList ? "Đã thích" : "Yêu thích"}
                  </span>
                </button>

                {/* Chia sẻ */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="group flex flex-col items-center justify-center gap-1 transition-all hover:-translate-y-0.5 active:scale-95 px-2 cursor-pointer"
                  title="Chia sẻ phim"
                >
                  <Share2 className="w-6 h-6 text-white/80 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300" />
                  <span className="text-[12px] font-medium text-white/80 group-hover:text-white transition-colors">
                    {copied ? "Đã chép" : "Chia sẻ"}
                  </span>
                </button>

                {/* Bình luận */}
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById("comment-section");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="group flex flex-col items-center justify-center gap-1 transition-all hover:-translate-y-0.5 active:scale-95 px-2 cursor-pointer"
                  title="Bình luận"
                >
                  <MessageCircle className="w-6 h-6 text-white/80 group-hover:text-red-400 group-hover:scale-110 transition-all duration-300" />
                  <span className="text-[12px] font-medium text-white/80 group-hover:text-white transition-colors">
                    Bình luận
                  </span>
                </button>
              </div>
            </div>

            {/* Mobile Accordion "Thông tin phim ▾" */}
            <div className="md:hidden w-full mb-6 mt-1 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsMobileInfoOpen(!isMobileInfoOpen)}
                className="flex items-center gap-2 text-sm font-bold py-2 px-4 rounded-full bg-white/[0.06] border border-white/10 text-red-400 transition-colors"
              >
                <span>Thông tin phim</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ${
                    isMobileInfoOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isMobileInfoOpen && (
                <div className="w-full text-left mt-3 p-4 rounded-xl bg-[#161824] border border-white/10 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-1 gap-2 text-xs text-zinc-300 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Trạng thái:</span>
                      <span>
                        {movie.type === "series"
                          ? `Đã chiếu: ${episodes.length} / ${movie.totalEpisodes || episodes.length} tập`
                          : "Hoàn tất"}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Loại phim:</span>
                      <span>{movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Năm:</span>
                      <span>{movie.year || "2026"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Thời lượng:</span>
                      <span>{movie.duration || "Đang cập nhật"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Thể loại:</span>
                      <span>{movie.genres?.join(", ") || "Đang cập nhật"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Quốc gia:</span>
                      <span>{movie.country || "Quốc tế"}</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-zinc-500 shrink-0 w-24">Đạo diễn:</span>
                      <span>{movie.director || "Đang cập nhật"}</span>
                    </div>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <h4 className="text-xs font-bold text-white mb-1.5">Nội dung phim</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      {movie.description || "Nội dung phim đang được cập nhật."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* AIRING SCHEDULE BANNER */}
            {movie.type === "series" && scheduleInfo && (
              <div className="mb-6">
                <AiringScheduleBanner
                  movieId={movie.id}
                  movieTitle={movie.title}
                  schedule={scheduleInfo}
                />
              </div>
            )}

            {/* 3. TABS NAVIGATION SECTION (Tập phim / Diễn viên) */}
            <div id="movie-tabs-content" className="mt-8">
              {/* Tabs Bar with RubbyFilm Red active indicator */}
              <div className="flex items-center gap-6 sm:gap-8 border-b border-white/10 mb-6 overflow-x-auto no-scrollbar">
                {episodes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("episodes")}
                    className={`pb-3 text-sm md:text-base font-bold transition-all relative whitespace-nowrap cursor-pointer ${
                      activeTab === "episodes"
                        ? "text-red-500"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span>{movie.type === "single" ? "Bản phim" : "Tập phim"}</span>
                    <span className="text-xs ml-1.5 font-normal text-zinc-500">
                      ({episodes.length})
                    </span>
                    {activeTab === "episodes" && (
                      <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand rounded-t-md shadow-sm shadow-red-600/50" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab("cast")}
                  className={`pb-3 text-sm md:text-base font-bold transition-all relative whitespace-nowrap cursor-pointer ${
                    activeTab === "cast" || episodes.length === 0
                      ? "text-red-500"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span>Diễn viên & Đạo diễn</span>
                  {(activeTab === "cast" || episodes.length === 0) && (
                    <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-brand rounded-t-md shadow-sm shadow-red-600/50" />
                  )}
                </button>
              </div>

              {/* TAB 1: EPISODES */}
              {(activeTab === "episodes" || episodes.length === 0) && episodes.length > 0 && (
                <div className="animate-in fade-in duration-300 space-y-5">
                  {/* Server selector + Season Filter + Search */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Server Pills */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 mr-1">
                        <Server className="w-3.5 h-3.5 text-brand" />
                        <span>Máy chủ:</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedServer(0)}
                        className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border font-semibold transition-all ${
                          selectedServer === 0
                            ? "bg-brand text-white border-brand shadow-sm shadow-red-600/30"
                            : "bg-white/5 text-zinc-300 border-white/10 hover:border-white/30"
                        }`}
                      >
                        <span>VIP Fast</span>
                        <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">
                          1
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedServer(1)}
                        className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 border font-semibold transition-all ${
                          selectedServer === 1
                            ? "bg-brand text-white border-brand shadow-sm shadow-red-600/30"
                            : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
                        }`}
                      >
                        <span>Backup HD</span>
                        <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                          2
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Season Groups (if multi-season) */}
                  {seasonGroups.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                      {seasonGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setSelectedSeason(group.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border ${
                            selectedSeason === group.id
                              ? "bg-brand text-white border-brand font-bold shadow-sm shadow-red-600/30"
                              : "bg-[#161824] text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {group.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Episode Buttons Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                    {filteredEpisodes.map((ep) => {
                      const isWatched = isMounted && isEpisodeWatched(movie.id, ep.episodeNumber);
                      const isCurrent = isMounted && savedProgress?.episodeNumber === ep.episodeNumber;

                      return (
                        <Link
                          key={ep.id}
                          href={`/watch/${movie.slug}?episode=${ep.episodeNumber}`}
                          className={`group flex items-center justify-center gap-1.5 rounded-xl transition-all py-2.5 px-2 text-xs sm:text-sm font-semibold shadow-sm select-none border ${
                            isCurrent
                              ? "bg-brand text-white border-brand font-black shadow-md shadow-brand/20 scale-[1.02]"
                              : isWatched
                              ? "bg-[#191B24] text-zinc-300 border-emerald-500/30 hover:border-brand/60 hover:text-red-400"
                              : "bg-[#191B24] text-white/90 border-white/[0.08] hover:border-brand/60 hover:text-red-400 hover:bg-[#202330]"
                          }`}
                        >
                          <Play
                            className={`shrink-0 w-3 h-3 transition-colors ${
                              isCurrent
                                ? "fill-white text-white"
                                : "fill-white/80 group-hover:fill-red-500 text-transparent"
                            }`}
                          />
                          <span>
                            {ep.name && ep.name.toLowerCase() === "full"
                              ? "Bản Full"
                              : movie.type === "single"
                              ? `Bản Full (${ep.name})`
                              : `Tập ${ep.episodeNumber}`}
                          </span>
                          {isWatched && !isCurrent && (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400 ml-0.5" />
                          )}
                        </Link>
                      );
                    })}

                    {/* Upcoming Unreleased Episodes with "Sắp chiếu" / Lock Modal */}
                    {scheduleInfo && scheduleInfo.totalEpisodes > episodes.length && (
                      Array.from(
                        { length: Math.min(scheduleInfo.totalEpisodes - episodes.length, 16) },
                        (_, i) => {
                          const epNum = episodes.length + 1 + i;
                          const isNext = epNum === episodes.length + 1;
                          return (
                            <button
                              key={`upcoming-${epNum}`}
                              type="button"
                              onClick={() => setSelectedUpcomingEp(epNum)}
                              className={`group flex items-center justify-center gap-1.5 rounded-xl transition-all py-2.5 px-2 text-xs sm:text-sm font-medium border cursor-pointer ${
                                isNext
                                  ? "bg-red-500/10 border-red-500/40 text-red-300 hover:bg-red-500/20 hover:border-brand"
                                  : "bg-[#161824]/40 border-white/[0.04] text-zinc-500 hover:text-zinc-400 hover:border-white/10"
                              }`}
                              title={isNext ? "Tập sắp phát sóng" : "Chưa chiếu"}
                            >
                              {isNext ? (
                                <Sparkles className="w-3 h-3 text-red-400 animate-pulse shrink-0" />
                              ) : (
                                <Lock className="w-3 h-3 text-zinc-600 shrink-0" />
                              )}
                              <span>Tập {epNum}</span>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: CAST & CREW */}
              {(activeTab === "cast" || episodes.length === 0) && (
                <div className="animate-in fade-in duration-300 space-y-6">
                  {/* Director */}
                  {movie.director && (
                    <div className="bg-[#161824] border border-white/10 rounded-2xl p-5">
                      <h4 className="text-xs uppercase font-bold text-brand tracking-wider mb-2 flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        <span>Đạo diễn</span>
                      </h4>
                      <Link
                        href={`/search?director=${encodeURIComponent(movie.director)}`}
                        className="text-base font-semibold text-white hover:text-red-400 transition-colors inline-block"
                      >
                        {movie.director} →
                      </Link>
                    </div>
                  )}

                  {/* Actors Grid */}
                  <div>
                    <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand" />
                      <span>Danh sách diễn viên</span>
                    </h4>
                    {movie.cast && movie.cast.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {movie.cast.map((actor) => (
                          <Link
                            key={actor}
                            href={`/search?actor=${encodeURIComponent(actor.trim())}`}
                            className="flex items-center gap-2.5 p-3 rounded-xl bg-[#161824] hover:bg-[#1E2130] border border-white/10 hover:border-brand/40 transition-all group"
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-600 to-rose-700 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-md">
                              {actor.trim().charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold text-zinc-200 group-hover:text-red-300 transition-colors line-clamp-1">
                              {actor.trim()}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">Danh sách diễn viên đang được cập nhật.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* 4. COMMUNITY RATINGS & COMMENTS (Always accessible on page flow) */}
        <div id="comment-section" className="mt-14 border-t border-white/10 pt-10 space-y-8">
          {/* Rating Section */}
          <div className="bg-[#161824] border border-white/10 rounded-2xl p-5 shadow-lg">
            <RatingSection
              movieId={movie.id}
              movieSlug={movie.slug}
              onJumpToComments={() => {
                const el = document.getElementById("community-comments-box");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
            />
          </div>

          {/* Threaded Comment Section */}
          <div id="community-comments-box">
            <CommentSection movieId={movie.id} />
          </div>
        </div>

        {/* 5. RELATED MOVIES & RECOMMENDATIONS */}
        {relatedMovies && relatedMovies.length > 0 && (
          <div className="mt-16 border-t border-white/10 pt-10">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1.5 h-6 rounded-full bg-brand inline-block shadow-sm shadow-red-600/40" />
              <h3 className="text-2xl font-extrabold text-white tracking-[-0.02em] flex items-center gap-2">
                <span>Phim Cùng Thể Loại & Đề Xuất</span>
              </h3>
            </div>
            <MovieGrid movies={relatedMovies} />
          </div>
        )}
      </div>

      {/* 4. YOUTUBE TRAILER MODAL - Clean without extra icon */}
      {isTrailerOpen && trailerEmbedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-black rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#161824] border-b border-white/10">
              <h4 className="text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                Trailer: {movie.title}
              </h4>
              <button
                type="button"
                onClick={() => setIsTrailerOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Iframe Container */}
            <div className="relative aspect-video w-full bg-black">
              <iframe
                src={trailerEmbedUrl}
                title={`Trailer ${movie.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}

      {/* 5. UPCOMING EPISODE MODAL */}
      {selectedUpcomingEp && scheduleInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-[#161824] border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center">
            <button
              type="button"
              onClick={() => setSelectedUpcomingEp(null)}
              className="absolute right-4 top-4 text-zinc-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-500 mx-auto flex items-center justify-center mb-4">
              <Clock className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-white mb-1">
              Tập {selectedUpcomingEp} - {movie.title}
            </h4>

            <p className="text-xs text-red-400 font-semibold mb-4">
              {scheduleInfo.nextEpisodeNumber === selectedUpcomingEp
                ? scheduleInfo.formattedNextAirDate
                : "Chưa tới lịch phát sóng chính thức"}
            </p>

            <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
              {scheduleInfo.scheduleText}
            </p>

            <Button
              variant="primary"
              onClick={async () => {
                const nextState = await toggleEpisodeReminder({
                  movieId: movie.id,
                  movieTitle: movie.title,
                  episodeNumber: selectedUpcomingEp,
                  targetTimestamp: scheduleInfo.nextAirDate.getTime(),
                  scheduledAirDate: scheduleInfo.formattedNextAirDate,
                });
                toast.success(
                  nextState ? "Đã bật nhắc nhở!" : "Đã hủy nhắc nhở",
                  nextState
                    ? `Bạn sẽ nhận thông báo khi Tập ${selectedUpcomingEp} lên sóng!`
                    : `Đã tắt thông báo Tập ${selectedUpcomingEp}`
                );
                setSelectedUpcomingEp(null);
              }}
              className="w-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white font-bold py-3 rounded-xl gap-2 shadow-lg shadow-red-600/30"
            >
              <Bell className="w-4 h-4 fill-current" />
              <span>Nhắc Tôi Khi Có Tập Này</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
