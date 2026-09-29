"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Heart,
  Info,
} from "lucide-react";
import { Movie } from "@/types/movie";
import { useMyList } from "@/lib/hooks/use-my-list";
import { formatRating } from "@/lib/utils";
import { FALLBACK_BACKDROP, FALLBACK_POSTER } from "@/lib/utils/image";
import { cn } from "@/lib/utils";
import { getBilingualTitles } from "@/lib/utils/title";
import { generateMovieSynopsis } from "@/lib/utils/synopsis";

interface MovieHeroProps {
  movies: Movie[];
}

export function MovieHero({ movies }: MovieHeroProps) {
  const [mounted, setMounted] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const touchStartXRef = React.useRef<number | null>(null);
  const { isInList, toggleMovie } = useMyList();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const heroMovies = React.useMemo(() => (movies || []).slice(0, 8), [movies]);
  const totalSlides = heroMovies.length;
  const currentMovie = heroMovies[currentIndex] || heroMovies[0];

  const nextSlide = React.useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = React.useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay (5 seconds per slide, continuous without pause on hover)
  React.useEffect(() => {
    if (totalSlides <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 5000);
    return () => clearInterval(timer);
  }, [totalSlides, nextSlide, currentIndex]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevSlide, nextSlide]);

  // Touch Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartXRef.current;
    if (Math.abs(deltaX) > 45) {
      if (deltaX > 0) {
        prevSlide();
      } else {
        nextSlide();
      }
    }
    touchStartXRef.current = null;
  };

  if (!currentMovie) {
    return (
      <div className="relative w-full h-[65vh] min-h-[500px] max-h-[750px] bg-[#0F0F0F] animate-pulse flex items-end pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full space-y-4">
          <div className="h-6 w-32 bg-[#1A1A1A] rounded-md" />
          <div className="h-12 w-3/4 bg-[#1A1A1A] rounded-lg" />
          <div className="h-4 w-1/2 bg-[#1A1A1A] rounded-md" />
          <div className="h-16 w-full bg-[#1A1A1A] rounded-lg" />
          <div className="flex gap-3">
            <div className="h-12 w-36 bg-[#1A1A1A] rounded-xl" />
            <div className="h-12 w-44 bg-[#1A1A1A] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <section
      suppressHydrationWarning
      aria-label="Phim đề cử đặc sắc"
      className="relative w-full h-[100svh] min-h-[640px] sm:h-[100vh] sm:min-h-[720px] lg:h-[100vh] lg:min-h-[780px] overflow-hidden bg-[#0F0F0F] select-none group/hero"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* TopHim Style Cinematic Multi-Plane Parallax Slides */}
      {heroMovies.map((m, idx) => {
        const isCurrent = idx === currentIndex;
        const isNearby =
          Math.abs(idx - currentIndex) <= 1 ||
          (currentIndex === 0 && idx === totalSlides - 1) ||
          (currentIndex === totalSlides - 1 && idx === 0);
        const isFav = mounted ? isInList(m.id) : false;
        return (
          <div
            key={m.id || idx}
            className={cn(
              "absolute inset-0 w-full h-full transition-opacity duration-[1200ms] ease-in-out",
              isCurrent
                ? "opacity-100 z-20 pointer-events-auto"
                : "opacity-0 z-10 pointer-events-none"
            )}
          >
            {/* Layer 1: Mobile-optimized Vertical Key Art + Ambient Glow & Desktop 16:9 Backdrop */}
            <div
              className={cn(
                "absolute inset-0 bg-[#0F0F0F] transition-transform duration-[1800ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                isCurrent
                  ? "translate-x-0 scale-100"
                  : "translate-x-[4%] scale-[1.04]"
              )}
            >
              {/* Mobile View: Crisp Vertical Key Art */}
              <div className="sm:hidden absolute inset-0">
                {isNearby && (
                  <Image
                    src={m.posterUrl || m.backdropUrl || FALLBACK_POSTER}
                    alt={m.title || "Phim nổi bật"}
                    fill
                    priority={idx === 0}
                    unoptimized={true}
                    className="object-cover object-top filter contrast-[1.02] transform-gpu"
                    sizes="(max-width: 640px) 100vw, 50vw"
                  />
                )}
              </div>

              {/* Desktop & Tablet: 16:9 Cinematic Landscape Backdrop (Crystal Clear 4K / Full HD) */}
              <div className="hidden sm:block absolute inset-0">
                {isNearby && (
                  <Image
                    src={m.backdropUrl || FALLBACK_BACKDROP}
                    alt={m.title || "Phim nổi bật"}
                    fill
                    priority={idx === 0}
                    unoptimized={true}
                    className="object-cover object-[center_25%] filter contrast-[1.02] transform-gpu"
                    sizes="100vw"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = FALLBACK_BACKDROP;
                    }}
                  />
                )}
              </div>
            </div>

            {/* Layer 2: Subtle Header Breathing Room (Clean, no dark fog) */}
            <div className="absolute top-0 left-0 right-0 h-24 sm:h-32 bg-gradient-to-b from-[#0F0F0F]/80 via-[#0F0F0F]/30 to-transparent pointer-events-none z-10" />

            {/* Layer 3: Text Contrast Lighting (Keeps image sharp, vivid & colorful) */}
            {/* Mobile: Clean bottom gradient only where title and buttons sit */}
            <div className="sm:hidden absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/70 via-35% to-transparent pointer-events-none z-10" />

            {/* Desktop: Crisp left gradient behind text and smooth bottom blend (Leaves right 60% ultra-clear) */}
            <div
              className="hidden sm:block absolute inset-0 pointer-events-none z-10"
              style={{
                background:
                  "linear-gradient(to right, rgba(15, 15, 15, 0.90) 0%, rgba(15, 15, 15, 0.55) 30%, rgba(15, 15, 15, 0.12) 55%, transparent 75%), linear-gradient(to top, #0F0F0F 0%, rgba(15, 15, 15, 0.5) 18%, transparent 35%)",
              }}
            />

            {/* Layer 5: Hero Content with Staggered Parallax Slide (1200ms ease + delay-[200ms]) */}
            <div className="relative h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pt-24 sm:pt-36 pb-24 sm:pb-36 lg:pb-32 z-20">
              <div
                className={cn(
                  "max-w-2xl select-none transition-all duration-[1200ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
                  isCurrent
                    ? "translate-x-0 opacity-100 delay-[200ms]"
                    : "-translate-x-8 opacity-0 delay-0"
                )}
              >
                {/* Movie Title: Logo Artwork OR Cinematic Typography */}
                {m.logoUrl ? (
                  <div className="relative mb-3 max-w-[270px] sm:max-w-[380px] md:max-w-[460px] h-[65px] sm:h-[95px] md:h-[115px]">
                    <Image
                      src={m.logoUrl}
                      alt={m.title}
                      fill
                      sizes="(max-width: 768px) 320px, 480px"
                      className="object-contain object-left-bottom drop-shadow-[0_4px_25px_rgba(0,0,0,0.9)] filter brightness-105"
                      priority={idx <= 1}
                    />
                  </div>
                ) : (
                  <h1
                    className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-[#F9FAFB] tracking-[-0.015em] leading-[1.08] mb-1.5 drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]"
                    style={{
                      fontFamily:
                        "var(--font-space-grotesk), var(--font-be-vietnam-pro), sans-serif",
                    }}
                  >
                    {
                      getBilingualTitles({
                        title: m.title,
                        originalTitle: m.originalTitle,
                        slug: m.slug,
                      }).primaryTitle
                    }
                  </h1>
                )}

                {/* Stylized English / Original Title (TopHim Signature Gold Accent) */}
                <p className="text-sm sm:text-base text-[#FECF59] font-semibold mb-3 tracking-wide drop-shadow-md">
                  {
                    getBilingualTitles({
                      title: m.title,
                      originalTitle: m.originalTitle,
                      slug: m.slug,
                    }).secondaryTitle
                  }
                </p>

                {/* Metadata Badges Row */}
                <div suppressHydrationWarning className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                  {/* HOT / Nhiều lượt xem Badge */}
                  {Boolean(m.isHot || (m.rating && m.rating >= 8.0)) && (
                    <span
                      suppressHydrationWarning
                      className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-black tracking-wider text-white bg-gradient-to-r from-[#E50000] to-[#B30000] shadow-md shadow-red-600/40 uppercase"
                    >
                      🔥 HOT
                    </span>
                  )}

                  {/* FHD / 4K Luxury Gradient Badge */}
                  <span
                    className="inline-flex items-center justify-center rounded px-2.5 py-1 text-[11px] font-black tracking-wider text-black shadow-md uppercase"
                    style={{
                      background:
                        "linear-gradient(220deg, #FFD875 0%, #FFE7A8 45%, #FFFFFF 100%)",
                    }}
                  >
                    {m.quality?.includes("4K")
                      ? "4K UHD"
                      : m.quality || "FHD"}
                  </span>

                  {/* Release Year */}
                  {m.year && (
                    <span className="px-2.5 py-1 rounded border border-white/20 bg-black/50 text-[#D1D5DB] font-medium backdrop-blur-sm text-[11px] sm:text-xs">
                      {m.year}
                    </span>
                  )}

                  {/* Episode / Status Badge */}
                  <span className="px-2.5 py-1 rounded border border-white/20 bg-black/50 text-[#D1D5DB] font-medium backdrop-blur-sm text-[11px] sm:text-xs">
                    {m.type === "series"
                      ? m.currentEpisode || "Hoàn Tất"
                      : m.duration || "Bản Đẹp"}
                  </span>

                  {/* Two-Tone TMDb Rating Badge */}
                  <div className="flex items-center text-[11px] font-bold rounded overflow-hidden border border-[rgba(1,180,228,0.5)] shadow-sm">
                    <span className="bg-[#01B4E4] text-white px-2 py-0.5">
                      TMDb
                    </span>
                    <span className="bg-[rgba(1,180,228,0.15)] text-white px-2 py-0.5 backdrop-blur-sm">
                      {formatRating(m.rating)}
                    </span>
                  </div>

                  {/* Genres */}
                  {m.genres &&
                    m.genres.slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="hidden md:inline-block px-2.5 py-1 rounded border border-white/10 bg-black/40 text-[#9CA3AF] text-[11px] backdrop-blur-sm"
                      >
                        {g}
                      </span>
                    ))}
                </div>

                {/* Synopsis / Description */}
                <p className="text-xs sm:text-sm md:text-base text-[#D1D5DB] line-clamp-2 max-w-xl mb-6 font-normal leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  {generateMovieSynopsis({
                    title: m.title,
                    originalTitle: m.originalTitle,
                    description: m.description,
                    year: m.year,
                    genres: m.genres,
                    country: m.country,
                  })}
                </p>

                {/* Call-to-Action Buttons */}
                <div className="flex items-center gap-3 sm:gap-4">
                  {/* Primary Button: Watch Movie */}
                  <Link
                    href={`/watch/${m.slug}`}
                    aria-label={`Xem phim ${m.title}`}
                    className="relative group/btn inline-flex items-center gap-2.5 px-6 sm:px-8 py-3 sm:py-3.5 rounded-full bg-gradient-to-r from-[#E50000] via-[#FF1A1A] to-[#B30000] text-white font-bold text-sm sm:text-base shadow-[0_4px_25px_rgba(229,0,0,0.5)] hover:shadow-[0_6px_35px_rgba(229,0,0,0.8)] hover:scale-105 active:scale-95 transition-all duration-300 overflow-hidden cursor-pointer"
                  >
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white translate-x-0.5 group-hover/btn:scale-110 transition-transform" />
                    <span className="tracking-wide">Xem Phim</span>
                  </Link>

                  {/* Secondary Button 1: Liquid Glass Circular Favorite */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toggleMovie(m);
                    }}
                    aria-label={
                      isFav
                        ? "Xóa khỏi danh sách yêu thích"
                        : "Thêm vào yêu thích"
                    }
                    title={isFav ? "Đã yêu thích" : "Yêu thích"}
                    className={cn(
                      "w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group/heart flex-shrink-0",
                      isFav
                        ? "bg-[#E50000]/15 border-[#E50000]/60 text-[#E50000] shadow-[0_0_20px_rgba(229,0,0,0.45)]"
                        : "bg-white/[0.08] hover:bg-white/[0.16] border-white/15 hover:border-[#E50000]/60 text-white hover:text-[#E50000] hover:shadow-[0_0_20px_rgba(229,0,0,0.35)]"
                    )}
                  >
                    <Heart
                      className={cn(
                        "w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 group-hover/heart:scale-110",
                        isFav
                          ? "fill-[#E50000] text-[#E50000]"
                          : "text-white stroke-[2]"
                      )}
                    />
                  </button>

                  {/* Secondary Button 2: Liquid Glass Circular Info */}
                  <Link
                    href={`/movie/${m.slug}`}
                    aria-label="Xem chi tiết phim"
                    title="Chi tiết phim"
                    className="w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-white/40 backdrop-blur-md flex items-center justify-center text-white hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 group/info flex-shrink-0 cursor-pointer"
                  >
                    <Info className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2] group-hover/info:scale-110 transition-transform duration-300" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Carousel Navigation (Persistent across slides) */}
      {totalSlides > 1 && (
        <>
          {/* Mobile Indicator Dots */}
          <div className="sm:hidden absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 pointer-events-auto">
            {heroMovies.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Chuyển đến slide ${idx + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === currentIndex
                    ? "w-6 bg-[#E50000]"
                    : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>

          {/* Desktop & Tablet Rich Thumbnails Container (sm:flex) */}
          <div className="hidden sm:flex absolute bottom-8 sm:bottom-10 md:bottom-12 left-1/2 -translate-x-1/2 md:left-auto md:right-8 lg:right-10 md:translate-x-0 z-30 items-center pointer-events-auto max-w-[calc(100%-2rem)] overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 sm:gap-2 px-0.5 py-1">
              {heroMovies.map((m, idx) => {
                const isActive = idx === currentIndex;
                return (
                  <button
                    key={m.id || idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    aria-label={`Chuyển đến phim ${m.title}`}
                    className={cn(
                      "relative shrink-0 rounded-lg sm:rounded-xl overflow-hidden transition-all duration-300 group/thumb shadow-lg cursor-pointer",
                      "w-14 sm:w-16 md:w-20 lg:w-[86px] aspect-[16/9]",
                      isActive
                        ? "border-2 border-[#E50000] ring-2 ring-[#E50000]/50 scale-105 opacity-100 shadow-[0_0_20px_rgba(229,0,0,0.6)] z-10"
                        : "border-2 border-white/15 opacity-60 hover:opacity-100 hover:border-white/50 hover:scale-105"
                    )}
                  >
                    <Image
                      src={m.backdropUrl || m.posterUrl || FALLBACK_BACKDROP}
                      alt={m.title}
                      fill
                      unoptimized
                      className="object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                      sizes="(max-width: 768px) 64px, 96px"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = FALLBACK_BACKDROP;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/25 group-hover/thumb:bg-transparent transition-colors" />

                    {isActive && (
                      <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#E50000] shadow-sm animate-pulse z-20" />
                    )}

                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/70 z-20 overflow-hidden">
                        <div
                          key={`prog-${currentIndex}`}
                          className="h-full bg-[#E50000] shadow-[0_0_8px_rgba(229,0,0,0.9)] animate-hero-progress"
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
