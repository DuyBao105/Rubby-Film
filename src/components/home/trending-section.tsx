"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Play, Heart, Info, Star } from "lucide-react";
import { Movie } from "@/types/movie";
import { getBilingualTitles } from "@/lib/utils/title";
import { useMyList } from "@/lib/hooks/use-my-list";
import { cn } from "@/lib/utils";

interface TrendingSectionProps {
  movies: Movie[];
  title?: string;
}

interface TrendingCardProps {
  movie: Movie;
  rank: number;
  index: number;
  total: number;
}

function TrendingCard({ movie, rank, index, total }: TrendingCardProps) {
  const [imgSrc, setImgSrc] = React.useState(movie.posterUrl);
  const [isHovered, setIsHovered] = React.useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const { isInList, toggleMovie } = useMyList();
  const inList = isInList(movie.id);

  React.useEffect(() => {
    setImgSrc(movie.posterUrl);
  }, [movie.posterUrl]);

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 220);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const { primaryTitle, secondaryTitle } = getBilingualTitles({
    title: movie.title,
    originalTitle: movie.originalTitle,
    slug: movie.slug,
  });

  // Calculate episode badge (e.g. "PĐ. Full", "PĐ. 12", "FHD")
  const episodeBadge = React.useMemo(() => {
    const ep = movie.currentEpisode || "";
    if (ep.toLowerCase().includes("hoàn") || ep.toLowerCase().includes("full")) {
      return "PĐ. Full";
    }
    const epMatch = ep.match(/\d+/);
    if (epMatch) {
      return `PĐ. ${epMatch[0]}`;
    }
    if (movie.type === "series") return "PĐ. Full";
    return movie.quality?.includes("4K") ? "4K Full" : "FHD";
  }, [movie.currentEpisode, movie.type, movie.quality]);

  // Status line (e.g. "HD • Hoàn tất (6/6)", "FHD • Hoàn tất")
  const statusLine = React.useMemo(() => {
    const qual = movie.quality?.includes("4K") ? "4K" : movie.quality || "HD";
    const status =
      movie.currentEpisode ||
      (movie.type === "series" ? "Hoàn tất" : movie.duration || "Bản Đẹp");
    return `${qual} • ${status}`;
  }, [movie.quality, movie.currentEpisode, movie.type, movie.duration]);

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex-shrink-0 w-[145px] sm:w-[195px] md:w-[215px] lg:w-[230px] select-none snap-start"
    >
      {/* Base Card Link */}
      <Link href={`/movie/${movie.slug}`} prefetch={true} className="group block w-full">
        {/* Poster */}
        <div className="relative aspect-[2/3] w-full rounded-2xl overflow-hidden bg-[#161616] shadow-lg mb-3">
          <Image
            src={
              imgSrc ||
              "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80"
            }
            alt={movie.title}
            fill
            unoptimized={true}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() =>
              setImgSrc(
                "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80"
              )
            }
          />

          {/* Subtle Bottom Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-80" />

          {/* Bottom Episode Pill Badge */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2">
            <span className="px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] sm:text-[11px] font-bold text-white/95 shadow-sm whitespace-nowrap">
              {episodeBadge}
            </span>
          </div>
        </div>

        {/* Info Row: Big Gold Italic Rank + Titles */}
        <div className="flex items-start gap-2.5 px-0.5">
          {/* Styled Gold Italic Number */}
          <span
            className="text-4xl sm:text-5xl font-black italic tracking-tighter text-[#E5B54F] leading-none select-none flex-shrink-0 min-w-[28px]"
            style={{ fontFamily: "Impact, var(--font-space-grotesk), sans-serif" }}
          >
            {rank}
          </span>

          {/* Title Details */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-extrabold text-sm sm:text-[15px] text-[#F9FAFB] tracking-[-0.02em] group-hover:text-[#E5B54F] transition-colors truncate leading-tight">
              {primaryTitle}
            </h3>
            <p className="text-xs text-[#9CA3AF] truncate leading-tight mt-0.5 font-normal">
              {secondaryTitle || movie.originalTitle || "RubyFilm Exclusive"}
            </p>
            <p className="text-[11px] text-[#D1D5DB] truncate leading-tight mt-1 font-medium">
              {statusLine}
            </p>
          </div>
        </div>
      </Link>

      {/* Expanded Quick-Preview Popover Modal on Hover (Desktop only, hidden on mobile touch) */}
      {isHovered && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "hidden md:block absolute z-50 w-[290px] sm:w-[320px] md:w-[340px] -top-3 sm:-top-4 rounded-2xl bg-[#14161F]/95 backdrop-blur-2xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden transition-all duration-200 animate-in fade-in zoom-in-95",
            index === 0
              ? "left-0"
              : index >= total - 2
              ? "right-0"
              : "left-1/2 -translate-x-1/2"
          )}
        >
          {/* Top Landscape Backdrop with Bottom Gradient Blend */}
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#161616]">
            <Image
              src={
                movie.backdropUrl ||
                movie.posterUrl ||
                "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80"
              }
              alt={movie.title}
              fill
              unoptimized={true}
              sizes="340px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#14161F] via-[#14161F]/30 to-black/20" />
            <div className="absolute top-2.5 right-2.5">
              <span className="px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-[10px] font-bold text-white shadow-sm">
                Top #{rank}
              </span>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-4 pt-2">
            {/* Vietnamese Title */}
            <h4 className="font-extrabold text-base sm:text-[17px] text-[#F9FAFB] tracking-[-0.02em] leading-snug drop-shadow line-clamp-1">
              {primaryTitle}
            </h4>

            {/* English Title */}
            <p className="text-xs sm:text-[13px] font-medium text-[#9CA3AF] line-clamp-1 mt-0.5">
              {secondaryTitle || movie.originalTitle || "RubyFilm"}
            </p>

            {/* Action Buttons Row: Xem ngay, Thích, Chi tiết */}
            <div className="flex items-center gap-2 my-3">
              <Link
                href={`/watch/${movie.slug}`}
                prefetch={true}
                className="flex-1 bg-gradient-to-r from-[#E50000] via-[#FF1A1A] to-[#B30000] hover:brightness-110 text-white font-extrabold text-xs sm:text-[13px] py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-red-600/30 transition-all active:scale-95"
              >
                <Play className="w-3.5 h-3.5 fill-white text-white" />
                <span>Xem ngay</span>
              </Link>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleMovie(movie);
                }}
                className="bg-[#22252C] hover:bg-[#2C3039] text-white font-semibold text-xs sm:text-[13px] py-2 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Heart
                  className={cn(
                    "w-3.5 h-3.5",
                    inList ? "fill-[#E50000] text-[#E50000]" : "text-white"
                  )}
                />
                <span>{inList ? "Đã thích" : "Thích"}</span>
              </button>

              <Link
                href={`/movie/${movie.slug}`}
                prefetch={true}
                className="bg-[#22252C] hover:bg-[#2C3039] text-white font-semibold text-xs sm:text-[13px] py-2 px-3 rounded-xl border border-white/10 flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Info className="w-3.5 h-3.5 text-white" />
                <span>Chi tiết</span>
              </Link>
            </div>

            {/* Badges Row: TMDb, Year, Quality, Status, Vietsub */}
            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium">
              {/* Rating */}
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>{movie.rating ? movie.rating.toFixed(1) : "8.1"}</span>
              </div>

              {/* Year */}
              {movie.year && (
                <span className="px-2 py-0.5 rounded bg-[#22252C] border border-white/10 text-white/80">
                  {movie.year}
                </span>
              )}

              {/* Quality */}
              <span className="px-2 py-0.5 rounded bg-red-600/20 border border-red-500/40 text-red-300 font-bold text-[10px] uppercase">
                {movie.quality?.includes("4K") ? "4K" : movie.quality || "FHD"}
              </span>

              {/* Status */}
              <span className="px-2 py-0.5 rounded bg-[#22252C] border border-white/10 text-white/70">
                {movie.currentEpisode ||
                  (movie.type === "series" ? "Hoàn tất" : "Bản Đẹp")}
              </span>

              {/* Vietsub */}
              <span className="px-2 py-0.5 rounded bg-[#22252C] border border-white/10 text-white/70">
                Vietsub
              </span>
            </div>

            {/* Genres */}
            <p className="text-xs text-[#8E8E93] truncate mt-2.5 font-medium">
              {movie.genres && movie.genres.length > 0
                ? movie.genres.slice(0, 3).join(" • ")
                : "Hành Động • Khoa Học"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function TrendingSection({
  movies,
  title = "Top 10 phim bộ hôm nay",
}: TrendingSectionProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScroll = React.useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  }, []);

  React.useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [movies, checkScroll]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const scrollAmount = direction === "left" ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
      setTimeout(checkScroll, 350);
    }
  };

  if (!movies || movies.length === 0) return null;

  return (
    <section id="trending" className="py-6 sm:py-8 relative select-none z-30 w-full">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="px-4 sm:px-6 lg:px-8 mb-4 sm:mb-5">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
            {title}
          </h2>
        </div>

        {/* Relative Carousel Container with Floating Circular Nav Buttons */}
        <div className="relative group/carousel">
          {/* Left Floating Arrow Button (Desktop only - hidden on mobile so it does not block movie posters) */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label="Xem phim trước"
              className="hidden md:flex absolute left-2 sm:left-4 top-[38%] -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 hover:bg-white text-black shadow-2xl items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border border-black/10 cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
            </button>
          )}

          {/* Right Floating Arrow Button (Desktop only - hidden on mobile so it does not block movie posters) */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label="Xem phim kế tiếp"
              className="hidden md:flex absolute right-2 sm:right-4 top-[38%] -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white/95 hover:bg-white text-black shadow-2xl items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 border border-black/10 cursor-pointer"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.5]" />
            </button>
          )}

          {/* Carousel Row */}
          <div
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-3 sm:gap-5 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 pt-3 pb-6 scroll-smooth no-scrollbar snap-x snap-mandatory touch-pan-x"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
          >
            {movies.slice(0, 10).map((movie, index) => (
              <TrendingCard
                key={movie.id}
                movie={movie}
                rank={index + 1}
                index={index}
                total={Math.min(movies.length, 10)}
              />
            ))}
            {/* End buffer for mobile scroll so last card isn't stuck to right edge */}
            <div className="w-4 sm:w-6 shrink-0" aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
