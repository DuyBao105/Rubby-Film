"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Heart,
  Info,
  Star,
  Calendar,
  Clock,
} from "lucide-react";
import { Movie } from "@/types/movie";
import { Badge } from "@/components/ui/badge";
import { useMyList } from "@/lib/hooks/use-my-list";
import { formatRating, cn } from "@/lib/utils";
import { FALLBACK_BACKDROP, FALLBACK_POSTER } from "@/lib/utils/image";
import { getBilingualTitles } from "@/lib/utils/title";

interface EditorialSpotlightProps {
  movie?: Movie;
  movies?: Movie[];
}

export function EditorialSpotlight({ movie, movies }: EditorialSpotlightProps) {
  const [mounted, setMounted] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);
  const [justToggled, setJustToggled] = React.useState(false);
  const touchStartXRef = React.useRef<number | null>(null);
  const { isInList, toggleMovie } = useMyList();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const movieList = React.useMemo(() => {
    if (movies && movies.length > 0) return movies;
    if (movie) return [movie];
    return [];
  }, [movies, movie]);

  const totalSlides = movieList.length;
  const currentMovie = movieList[currentIndex] || movieList[0];

  const nextSlide = React.useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = React.useCallback(() => {
    if (totalSlides <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  // Autoplay every 5.5s with pause on hover
  // Autoplay every 7.5s with pause on hover
  React.useEffect(() => {
    if (totalSlides <= 1 || isPaused) return;
    const timer = setInterval(() => {
      nextSlide();
    }, 7500);
    return () => clearInterval(timer);
  }, [totalSlides, isPaused, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) nextSlide();
      else prevSlide();
    }
    touchStartXRef.current = null;
  };

  const handleToggle = () => {
    if (!currentMovie) return;
    toggleMovie(currentMovie);
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 800);
  };

  if (!currentMovie) return null;

  const inList = mounted ? isInList(currentMovie.id) : false;

  const { primaryTitle, secondaryTitle } = getBilingualTitles({
    title: currentMovie.title,
    originalTitle: currentMovie.originalTitle,
    slug: currentMovie.slug,
  });

  return (
    <section className="py-10 sm:py-14 select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="relative rounded-2xl overflow-hidden border border-[#282828] bg-[#141414] shadow-2xl group/spotlight"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Panoramic Ambient Backdrop - High Clarity & Sharpness (Desktop & Large screens) */}
          <div key={`bg-${currentMovie.slug}`} className="absolute inset-0 z-0 hidden lg:block animate-fade-in">
            <Image
              src={currentMovie.backdropUrl || currentMovie.posterUrl || FALLBACK_BACKDROP}
              alt={primaryTitle}
              fill
              unoptimized={true}
              className="object-cover object-right filter contrast-[1.08] saturate-[1.06] brightness-[1.02] transform-gpu"
              sizes="1280px"
              style={{
                imageRendering: "-webkit-optimize-contrast",
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = FALLBACK_BACKDROP;
              }}
            />
            {/* Gradients: Left deep for text readability, right clear for visual artwork */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#0F0F0F] via-[#0F0F0F]/85 md:via-[#0F0F0F]/45 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F]/90 via-transparent to-black/20 pointer-events-none" />
          </div>

          {/* Foreground Editorial Content */}
          <div className="relative z-10 p-5 sm:p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Visual Media Banner on Mobile & Tablet (< lg) - Full 16:9 Cinema View without Cropping */}
            <div
              key={`mob-${currentMovie.slug}`}
              className="lg:hidden relative w-full aspect-[16/9] rounded-2xl overflow-hidden border border-[#282828] group/mob shadow-2xl bg-[#1A1A1A] animate-fade-in"
            >
              <Image
                src={currentMovie.backdropUrl || currentMovie.posterUrl || FALLBACK_BACKDROP}
                alt={primaryTitle}
                fill
                unoptimized={true}
                className="object-cover object-center group-hover/mob:scale-105 transition-transform duration-500 filter contrast-[1.08] saturate-[1.06] brightness-[1.02] transform-gpu"
                sizes="(max-width: 1024px) 100vw, 800px"
                style={{
                  imageRendering: "-webkit-optimize-contrast",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = currentMovie.posterUrl || FALLBACK_BACKDROP;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20 pointer-events-none" />

              {/* Central Glowing Play Button */}
              <Link
                href={`/watch/${currentMovie.slug}`}
                className="absolute inset-0 flex items-center justify-center z-10 group/btn"
                aria-label={`Xem phim ${primaryTitle}`}
              >
                <div className="w-13 h-13 sm:w-16 sm:h-16 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-2xl shadow-[#E50000]/60 group-hover/btn:scale-110 active:scale-95 transition-transform border border-white/20">
                  <Play className="w-6 h-6 sm:w-7 sm:h-7 fill-current ml-0.5" />
                </div>
              </Link>

              {/* Badges on top */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-white text-[11px] font-bold border border-white/20 shadow">
                  {currentMovie.quality?.includes("4K") ? "4K HDR" : currentMovie.quality || "FHD"}
                </span>
                {currentMovie.rating ? (
                  <span className="px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-amber-400 text-[11px] font-bold border border-white/20 flex items-center gap-1 shadow">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {formatRating(currentMovie.rating)}
                  </span>
                ) : null}
              </div>
            </div>

            <div key={`content-${currentMovie.slug}`} className="lg:col-span-8 max-w-2xl animate-fade-in">
              {/* StreamVibe Editorial Tag */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#0F0F0F]/90 border border-[#262626] text-white text-xs font-semibold shadow-sm backdrop-blur-sm mb-4">
                <span className="w-2 h-2 rounded-full bg-[#E50000] animate-pulse" />
                <span>TIÊU ĐIỂM ĐIỆN ẢNH TUYỂN CHỌN</span>
              </div>

              {/* Bilingual Titles: 800 ExtraBold, -0.02em letter spacing, #F9FAFB ivory white */}
              <h3 className="text-2xl sm:text-3xl md:text-5xl font-extrabold text-[#F9FAFB] tracking-[-0.02em] leading-tight mb-1 drop-shadow-md">
                {primaryTitle}
              </h3>

              <p className="text-sm sm:text-base text-[#FECF59] font-medium italic mb-4 tracking-wide">
                {secondaryTitle}
              </p>

              {/* Metadata Badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
                <Badge variant="rating" className="bg-[#0F0F0F] border border-[#262626] text-[11px] px-2 py-0.5">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400 mr-1" />
                  <span className="font-bold">{formatRating(currentMovie.rating)}</span>
                </Badge>

                <span className="bg-[#0F0F0F] border border-[#262626] text-[#D1D5DB] font-semibold text-[11px] px-2 py-0.5 rounded-md">
                  {currentMovie.quality?.includes("4K") ? "4K HDR" : currentMovie.quality || "HD"}
                </span>

                {currentMovie.year && (
                  <div className="flex items-center gap-1 text-cinema-300 bg-[#0F0F0F] px-2 py-0.5 rounded-md border border-[#262626]">
                    <Calendar className="w-3 h-3 text-cinema-400" />
                    <span>{currentMovie.year}</span>
                  </div>
                )}

                {currentMovie.duration && (
                  <div className="flex items-center gap-1 text-cinema-300 bg-[#0F0F0F] px-2 py-0.5 rounded-md border border-[#262626]">
                    <Clock className="w-3 h-3 text-cinema-400" />
                    <span>{currentMovie.duration}</span>
                  </div>
                )}
              </div>

              {/* Genre tags */}
              {currentMovie.genres && currentMovie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {currentMovie.genres.slice(0, 4).map((g) => (
                    <span
                      key={g}
                      className="text-xs text-cinema-300 bg-[#0F0F0F] border border-[#262626] rounded-md px-2.5 py-0.5"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Storyline Overview: 400 Regular, 1.6 line height, #D1D5DB light gray */}
              <p className="text-xs sm:text-sm md:text-base text-[#D1D5DB] font-normal leading-[1.6] line-clamp-3 mb-6">
                {currentMovie.description}
              </p>

              {/* Action Buttons: Apple TV+ Luxury Style */}
              <div className="flex items-center gap-3 sm:gap-3.5 pt-1">
                {/* Primary Play Button (Solid Snow White Pill with Black Play Icon & Bold Text) */}
                <Link
                  href={`/watch/${currentMovie.slug}`}
                  aria-label={`Xem phim ${primaryTitle}`}
                  className="relative group/play flex items-center justify-center gap-2.5 h-12 sm:h-13 px-7 sm:px-8 rounded-full bg-white hover:bg-neutral-100 text-black font-black text-sm sm:text-base shadow-[0_4px_24px_rgba(255,255,255,0.28)] hover:shadow-[0_6px_32px_rgba(255,255,255,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 flex-shrink-0 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-black text-black ml-0.5 group-hover/play:scale-110 transition-transform duration-300" />
                  <span className="tracking-wide">Xem Phim</span>
                </Link>

                {/* Secondary Button 1: Liquid Glass Circular Favorite */}
                <button
                  type="button"
                  onClick={handleToggle}
                  aria-label={inList ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
                  title={inList ? "Đã yêu thích" : "Yêu thích"}
                  className={cn(
                    "w-12 h-12 sm:w-13 sm:h-13 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group/heart flex-shrink-0",
                    inList
                      ? "bg-[#E50000]/15 border-[#E50000]/60 text-[#E50000] shadow-[0_0_20px_rgba(229,0,0,0.45)]"
                      : "bg-white/[0.08] hover:bg-white/[0.16] border-white/15 hover:border-[#E50000]/60 text-white hover:text-[#E50000] hover:shadow-[0_0_20px_rgba(229,0,0,0.35)]"
                  )}
                >
                  <Heart
                    className={cn(
                      "w-5 h-5 transition-transform duration-300 group-hover/heart:scale-110",
                      inList ? "fill-[#E50000] text-[#E50000]" : "text-white stroke-[2]",
                      justToggled && "scale-125 animate-pulse"
                    )}
                  />
                </button>

                {/* Secondary Button 2: Liquid Glass Circular Info */}
                <Link
                  href={`/movie/${currentMovie.slug}`}
                  aria-label={`Thông tin chi tiết phim ${primaryTitle}`}
                  title="Chi tiết phim"
                  className="w-12 h-12 sm:w-13 sm:h-13 rounded-full bg-white/[0.08] hover:bg-white/[0.16] border border-white/15 hover:border-white/40 backdrop-blur-md flex items-center justify-center text-white hover:text-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95 transition-all duration-300 group/info flex-shrink-0 cursor-pointer"
                >
                  <Info className="w-5 h-5 text-white stroke-[2] group-hover/info:scale-110 transition-transform duration-300" />
                </Link>
              </div>
            </div>

            {/* Poster Card on Desktop */}
            <div key={`poster-${currentMovie.slug}`} className="hidden lg:flex lg:col-span-4 justify-end animate-fade-in">
              <Link
                href={`/watch/${currentMovie.slug}`}
                className="relative w-64 aspect-poster rounded-2xl overflow-hidden shadow-2xl border border-[#262626] bg-[#1A1A1A] group/art transform hover:-translate-y-1 transition-all duration-500 hover:border-[#E50000]/50"
              >
                <Image
                  src={currentMovie.posterUrl || FALLBACK_POSTER}
                  alt={currentMovie.title}
                  fill
                  className="object-cover transition-transform duration-500 group-hover/art:scale-105 filter contrast-[1.06] saturate-[1.05] transform-gpu"
                  sizes="260px"
                  style={{
                    imageRendering: "-webkit-optimize-contrast",
                  }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = FALLBACK_POSTER;
                  }}
                />
                <div className="absolute inset-0 bg-black/40 group-hover/art:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-2xl shadow-[#E50000]/50 group-hover/art:scale-110 transition-transform">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                </div>
              </Link>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
