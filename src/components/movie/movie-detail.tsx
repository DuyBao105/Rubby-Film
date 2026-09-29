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
} from "lucide-react";
import { Movie, Episode } from "@/types/movie";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { getEpisodeSubtitle } from "@/lib/utils/episode";
import { formatRating } from "@/lib/utils";
import { FALLBACK_POSTER, FALLBACK_BACKDROP } from "@/lib/utils/image";
import { MovieGrid } from "./movie-grid";
import { RatingSkeleton } from "@/components/community/rating/rating-skeleton";
import { CommentSkeleton } from "@/components/community/comments/comment-skeleton";

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
  const { isInList, toggleMovie } = useMyList();
  const { getMovieProgress, isEpisodeWatched, getEpisodeProgress } = useWatchHistory();
  const [copied, setCopied] = React.useState(false);
  const [posterSrc, setPosterSrc] = React.useState(movie.posterUrl || FALLBACK_POSTER);
  const [backdropSrc, setBackdropSrc] = React.useState(movie.backdropUrl || FALLBACK_BACKDROP);
  const [selectedSeason, setSelectedSeason] = React.useState(1);

  React.useEffect(() => {
    setPosterSrc(movie.posterUrl || FALLBACK_POSTER);
    setBackdropSrc(movie.backdropUrl || FALLBACK_BACKDROP);
  }, [movie.posterUrl, movie.backdropUrl]);

  const inList = isInList(movie.id);
  const savedProgress = getMovieProgress(movie.id);
  const episodes = React.useMemo(() => movie.episodes || [], [movie.episodes]);

  // Group episodes into seasons or chunks if large series
  const seasonGroups = React.useMemo(() => {
    if (episodes.length === 0) return [];
    // If episodes specify seasonNumber > 1
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

    // If single season but has > 40 episodes, chunk into groups of 30 for great UX
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
        name: "Mùa 1 (Trọn bộ)",
        episodes: episodes,
      },
    ];
  }, [episodes]);

  const currentSeasonEpisodes =
    seasonGroups.find((g) => g.id === selectedSeason)?.episodes || episodes;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `${movie.title} - RubbyFilm`,
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
    : "Xem Phim Ngay";
  return (
    <div className="min-h-screen bg-cinema-900 pb-20 relative">
      {/* Backdrop Header with deep gradient vignettes as absolute background layer */}
      <div className="absolute top-0 left-0 right-0 h-[400px] sm:h-[500px] lg:h-[600px] overflow-hidden bg-cinema-950 pointer-events-none z-0">
        <Image
          src={backdropSrc}
          alt={movie.title}
          fill
          priority
          className="object-cover object-top opacity-35 sm:opacity-40 scale-105 filter blur-[0.5px]"
          sizes="100vw"
          onError={() => setBackdropSrc(FALLBACK_BACKDROP)}
        />
        {/* Cinematic Multi-directional Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-cinema-900 via-cinema-900/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-cinema-900 via-cinema-900/70 to-transparent w-full lg:w-3/4" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cinema-900 to-transparent" />
      </div>

      {/* Main Info Section - positioned cleanly right below the fixed header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 sm:pt-24 relative z-10">
        {/* Interactive Breadcrumbs with Back Button */}
        <div className="flex items-center gap-1.5 text-xs text-cinema-400 mb-4 sm:mb-5 overflow-x-auto whitespace-nowrap py-1 no-scrollbar">
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

          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:text-white transition-colors py-0.5 px-1 rounded hover:bg-white/5 flex-shrink-0"
          >
            <Home className="w-3.5 h-3.5 text-cinema-400" />
            <span>Trang chủ</span>
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-cinema-600 flex-shrink-0" />

          <Link
            href={movie.type === "series" ? "/series" : "/movies?type=single"}
            className="hover:text-white transition-colors py-0.5 px-1 rounded hover:bg-white/5 flex-shrink-0 font-medium"
          >
            {movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}
          </Link>

          <ChevronRight className="w-3.5 h-3.5 text-cinema-600 flex-shrink-0" />

          <span className="text-white font-semibold truncate max-w-[200px] sm:max-w-[320px] flex-shrink-0">
            {movie.title}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-10">
          {/* Poster Column */}
          <div className="md:col-span-4 lg:col-span-3 flex flex-col items-center md:items-start">
            <div className="relative w-52 sm:w-64 md:w-full aspect-poster rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-cinema-700/80 bg-cinema-850 group">
              <Image
                src={posterSrc}
                alt={movie.title}
                fill
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 256px, 320px"
                onError={() => setPosterSrc(FALLBACK_POSTER)}
              />
              <div className="absolute top-3 left-3">
                <Badge variant="rating" className="text-xs px-2.5 py-1 backdrop-blur-md bg-cinema-950/85 shadow-lg border border-amber-500/20">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-1" />
                  <span className="font-bold text-white">{formatRating(movie.rating)}</span>
                </Badge>
              </div>

              {movie.quality && (
                <div className="absolute top-3 right-3">
                  <Badge variant="brand" className="text-[11px] font-bold uppercase tracking-wider shadow-md">
                    {movie.quality}
                  </Badge>
                </div>
              )}
            </div>

            {/* Quick Watch & List action buttons under poster for mobile & desktop */}
            <div className="w-full mt-5 flex flex-col gap-3">
              <Link href={watchUrl} className="w-full">
                <Button variant="primary" size="lg" className="w-full font-bold gap-2 text-base shadow-lg shadow-brand/20 py-6">
                  <Play className="w-5 h-5 fill-current" />
                  <span>{watchButtonText}</span>
                </Button>
              </Link>

              <div className="grid grid-cols-2 gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => toggleMovie(movie)}
                  className={`gap-2 text-xs sm:text-sm h-11 border transition-all ${
                    inList
                      ? "border-brand/40 bg-brand/10 text-brand hover:bg-brand/20 hover:border-brand/60"
                      : "border-cinema-700 hover:border-cinema-500"
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 transition-transform active:scale-125 ${
                      inList ? "fill-brand text-brand scale-110" : "text-white"
                    }`}
                  />
                  <span>{inList ? "Đã Yêu Thích" : "Yêu Thích"}</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="gap-2 text-xs sm:text-sm h-11 border-cinema-700 hover:border-cinema-500 hover:bg-cinema-800"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{copied ? "Đã chép link!" : "Chia sẻ"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Details Column */}
          <div className="md:col-span-8 lg:col-span-9 flex flex-col pt-2 sm:pt-4">
            {/* Badges bar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Badge variant="brand" className="font-bold">
                {movie.quality || "HD"}
              </Badge>
              <Badge variant="secondary" className="bg-cinema-800 text-cinema-200 border-cinema-700">
                {movie.language || "Vietsub"}
              </Badge>
              <Badge variant="outline" className="border-cinema-700 text-cinema-300">
                {movie.type === "series" ? "Phim Bộ" : "Phim Lẻ"}
              </Badge>
              {movie.currentEpisode && (
                <Badge variant="outline" className="border-brand/40 text-brand bg-brand/10">
                  {movie.currentEpisode}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F9FAFB] tracking-[-0.02em] leading-tight drop-shadow-sm">
              {movie.title}
            </h1>
            <p className="text-base sm:text-lg text-[#9CA3AF] font-medium mt-1 mb-5 italic">
              {movie.originalTitle || movie.title}
            </p>

            {/* Metadata Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-cinema-850/80 border border-cinema-750/80 backdrop-blur-md mb-6">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cinema-800 border border-cinema-700 text-brand">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">Năm phát hành</div>
                  <div className="text-sm font-semibold text-[#F9FAFB]">{movie.year || "2024"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cinema-800 border border-cinema-700 text-brand">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">Thời lượng</div>
                  <div className="text-sm font-semibold text-[#F9FAFB]">{movie.duration || "Đang cập nhật"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cinema-800 border border-cinema-700 text-brand">
                  <Globe2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">Quốc gia</div>
                  <Link
                    href={`/country/${movie.countrySlug || "quoc-te"}`}
                    className="text-sm font-semibold text-[#F9FAFB] hover:text-brand transition-colors"
                  >
                    {movie.country || "Quốc tế"}
                  </Link>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cinema-800 border border-cinema-700 text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <div>
                  <div className="text-[10px] text-[#9CA3AF] uppercase tracking-wider font-medium">Đánh giá</div>
                  <div className="text-sm font-semibold text-amber-400">
                    {formatRating(movie.rating)} <span className="text-[11px] text-[#9CA3AF] font-normal">/ 10</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Genres */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-xs text-[#9CA3AF] font-medium mr-1">Thể loại:</span>
              {movie.genres && movie.genres.length > 0 ? (
                movie.genres.map((g, idx) => (
                  <Link
                    key={g}
                    href={`/genre/${movie.genreSlugs?.[idx] || g.toLowerCase()}`}
                    className="text-xs text-[#D1D5DB] bg-cinema-800 hover:bg-brand hover:text-cinema-950 border border-cinema-700 rounded-lg px-3 py-1.5 transition-colors font-medium"
                  >
                    {g}
                  </Link>
                ))
              ) : (
                <span className="text-xs text-[#9CA3AF]">Đang cập nhật</span>
              )}
            </div>

            {/* Community: 1..5 star rating (between metadata and synopsis) */}
            <div className="mb-6">
              <RatingSection
                movieId={movie.id}
                movieSlug={movie.slug}
                onJumpToComments={() => {
                  const el = document.getElementById("community-comments");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            </div>

            {/* Synopsis */}
            <div className="mb-6">
              <h2 className="text-lg font-extrabold text-[#F9FAFB] tracking-[-0.02em] mb-2.5 flex items-center gap-2">
                <Film className="w-4 h-4 text-brand" />
                <span>Nội dung phim</span>
              </h2>
              <div className="text-sm sm:text-base text-[#D1D5DB] font-normal leading-[1.6] space-y-2 bg-cinema-850/40 p-4 rounded-xl border border-cinema-800">
                <p>{movie.description || "Nội dung phim đang được cập nhật."}</p>
              </div>
            </div>

            {/* Cast & Crew */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-cinema-800/80">
              <div>
                <h3 className="text-xs uppercase font-semibold text-[#9CA3AF] tracking-wider mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-brand" />
                  <span>Đạo diễn</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center mt-1">
                  {movie.director && movie.director.trim() !== "" ? (
                    movie.director.split(",").map((dir) => {
                      const d = dir.trim();
                      return (
                        <Link
                          key={d}
                          href={`/search?director=${encodeURIComponent(d)}`}
                          className="text-xs sm:text-sm font-medium text-brand hover:text-white hover:bg-brand/20 bg-cinema-800/80 px-2.5 py-1 rounded-lg border border-cinema-700/80 hover:border-brand/50 transition-all inline-flex items-center gap-1.5 group/dir"
                          title={`Khám phá phim của đạo diễn ${d}`}
                        >
                          <span>{d}</span>
                          <span className="text-[10px] text-cinema-400 group-hover/dir:text-white">→</span>
                        </Link>
                      );
                    })
                  ) : (
                    <span className="text-sm text-[#9CA3AF]">Đang cập nhật</span>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xs uppercase font-semibold text-[#9CA3AF] tracking-wider mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand" />
                  <span>Diễn viên chính</span>
                </h3>
                <div className="flex flex-wrap gap-1.5 items-center mt-1">
                  {movie.cast && movie.cast.length > 0 ? (
                    movie.cast.map((actor) => {
                      const a = actor.trim();
                      if (!a) return null;
                      return (
                        <Link
                          key={a}
                          href={`/search?actor=${encodeURIComponent(a)}`}
                          className="text-xs sm:text-sm font-medium text-cinema-200 hover:text-white hover:bg-cinema-750 bg-cinema-800/80 px-2.5 py-1 rounded-lg border border-cinema-700/80 hover:border-cinema-500 transition-all inline-flex items-center gap-1.5 group/actor"
                          title={`Khám phá phim có sự tham gia của ${a}`}
                        >
                          <span>{a}</span>
                          <span className="text-[10px] text-cinema-500 group-hover/actor:text-brand">🎭</span>
                        </Link>
                      );
                    })
                  ) : (
                    <span className="text-sm text-[#9CA3AF]">Đang cập nhật</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Series Episodes Section (if movie has episodes) */}
        {episodes.length > 0 && (
          <div className="mt-14 p-6 sm:p-8 rounded-2xl bg-cinema-850/70 border border-cinema-700/60 shadow-xl">
            {/* Header + Season Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-cinema-750">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand/10 border border-brand/20 text-brand">
                  <Tv className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#F9FAFB] tracking-[-0.02em] flex items-center gap-2">
                    <span>Danh Sách Tập Phim</span>
                    <span className="text-xs text-[#9CA3AF] bg-cinema-800 px-2.5 py-0.5 rounded-full border border-cinema-700 font-semibold">
                      {episodes.length} tập
                    </span>
                  </h3>
                  <p className="text-xs text-[#D1D5DB] font-normal leading-[1.6] mt-0.5">
                    Chọn tập để bắt đầu xem ngay với chất lượng cao
                  </p>
                </div>
              </div>

              {/* Season / Group Selector */}
              {seasonGroups.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {seasonGroups.map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedSeason(group.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                        selectedSeason === group.id
                          ? "bg-brand text-cinema-950 border-brand shadow-sm shadow-brand/20"
                          : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:bg-cinema-700 hover:text-white"
                      }`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Episode Grid Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {currentSeasonEpisodes.map((ep) => {
                const isWatched = isEpisodeWatched(movie.id, ep.episodeNumber);
                const epProgress = getEpisodeProgress(movie.id, ep.episodeNumber);
                const isCurrent = savedProgress?.episodeNumber === ep.episodeNumber;

                return (
                  <Link
                    key={ep.id}
                    href={`/watch/${movie.slug}?episode=${ep.episodeNumber}`}
                    className={`relative flex flex-col p-3 rounded-xl border transition-all duration-200 group/ep select-none overflow-hidden ${
                      isCurrent
                        ? "bg-cinema-800 border-brand/70 shadow-md shadow-brand/10"
                        : "bg-cinema-800/80 hover:bg-cinema-750 border-cinema-700 hover:border-brand/40"
                    }`}
                  >
                    {/* Header: Ep Number + Watched Check */}
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-[#F9FAFB] group-hover/ep:text-brand transition-colors">
                        Tập {ep.episodeNumber}
                      </span>
                      {isWatched ? (
                        <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Đã xem">
                          <CheckCircle2 className="w-3 h-3" />
                        </span>
                      ) : isCurrent ? (
                        <span className="text-[10px] text-brand bg-brand/10 px-1.5 py-0.5 rounded border border-brand/20">
                          Đang xem
                        </span>
                      ) : null}
                    </div>

                    {/* Name / Duration */}
                    <span className="text-[11px] text-[#9CA3AF] group-hover/ep:text-[#D1D5DB] line-clamp-1">
                      {getEpisodeSubtitle(ep)}
                    </span>

                    {/* Progress Bar (if partially watched) */}
                    {epProgress && epProgress.progressPercent > 0 && !epProgress.completed && (
                      <div className="w-full bg-cinema-700 h-1 rounded-full overflow-hidden mt-2">
                        <div
                          className="bg-brand h-full rounded-full"
                          style={{ width: `${epProgress.progressPercent}%` }}
                        />
                      </div>
                    )}

                    {/* Hover Play Glow */}
                    <div className="absolute right-2 bottom-2 opacity-0 group-hover/ep:opacity-100 transition-opacity">
                      <div className="w-6 h-6 rounded-full bg-brand text-cinema-950 flex items-center justify-center shadow-md">
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Community: threaded comments (below cast & crew, above related movies) */}
        <div className="mt-14" id="community-comments">
          <CommentSection movieId={movie.id} />
        </div>

        {/* Related Movies Section */}
        {relatedMovies && relatedMovies.length > 0 && (
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1.5 h-6 rounded-full bg-brand inline-block shadow-sm shadow-brand/40" />
              <h3 className="text-2xl font-extrabold text-[#F9FAFB] tracking-[-0.02em] flex items-center gap-2">
                <span>Phim Cùng Thể Loại & Đề Xuất</span>
              </h3>
            </div>
            <MovieGrid movies={relatedMovies} />
          </div>
        )}
      </div>
    </div>
  );
}
