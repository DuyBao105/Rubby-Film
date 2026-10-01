"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, Play, Heart, Clock } from "lucide-react";
import { Movie } from "@/types/movie";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { cn, formatRating } from "@/lib/utils";
import { getBilingualTitles } from "@/lib/utils/title";

interface MovieCardProps {
  movie: Movie;
  priority?: boolean;
  className?: string;
  progressPercent?: number;
  rank?: number;
}

export function MovieCard({
  movie,
  priority = false,
  className,
  progressPercent,
  rank,
}: MovieCardProps) {
  const [mounted, setMounted] = React.useState(false);
  const [justToggled, setJustToggled] = React.useState(false);
  const { isInList, toggleMovie } = useMyList();
  const { getMovieProgress } = useWatchHistory();
  const inList = mounted ? isInList(movie.id) : false;
  const [imgSrc, setImgSrc] = React.useState(movie.posterUrl);

  const historyItem = mounted ? getMovieProgress(movie.id) : undefined;
  const effectiveProgress =
    typeof progressPercent === "number"
      ? progressPercent
      : historyItem && !historyItem.completed && historyItem.progressPercent > 0
      ? historyItem.progressPercent
      : undefined;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    setImgSrc(movie.posterUrl);
  }, [movie.posterUrl]);

  const handleToggleList = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMovie(movie);
    setJustToggled(true);
    setTimeout(() => setJustToggled(false), 800);
  };

  const { primaryTitle, secondaryTitle } = getBilingualTitles({
    title: movie.title,
    originalTitle: movie.originalTitle,
    slug: movie.slug,
  });

  return (
    <div
      className={cn(
        "group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-2xl bg-gradient-to-b from-[#1C1C1C] via-[#161616] to-[#111111] border border-[#282828] hover:border-[#E50000]/70 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_15px_35px_rgba(229,0,0,0.2)] shadow-lg select-none",
        className
      )}
    >
      {/* Poster Container */}
      <Link
        href={`/movie/${movie.slug}`}
        prefetch={true}
        className="block relative aspect-poster w-full rounded-xl overflow-hidden bg-[#111111]"
      >
        <Image
          src={imgSrc}
          alt={movie.title}
          fill
          unoptimized={true}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          priority={priority}
          onError={() =>
            setImgSrc(
              "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80"
            )
          }
        />

        {/* Subtle Cinematic Vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F]/90 via-transparent to-black/30 opacity-70 group-hover:opacity-90 transition-opacity" />

        {/* StreamVibe Rank Badge / 4K Badge */}
        {typeof rank === "number" && rank > 0 ? (
          <div className="absolute top-2 left-2 z-20 flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded-md bg-[#E50000] text-white font-black text-[11px] shadow-lg shadow-[#E50000]/50 border border-[#FF3333]/50 select-none">
            #{rank < 10 ? `0${rank}` : rank}
          </div>
        ) : typeof movie?.quality === "string" && movie.quality.includes("4K") ? (
          <div className="absolute top-2 left-2 z-10">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 backdrop-blur-md border border-amber-500/40 text-amber-300 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>4K</span>
            </span>
          </div>
        ) : null}

        {/* Episode / Year Pill Top Right */}
        <div className="absolute top-2 right-2 z-10">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#0F0F0F]/80 backdrop-blur-md border border-[#2E2E2E] text-[#D1D5DB] shadow-sm">
            {movie.type === "series" && movie.currentEpisode ? movie.currentEpisode : movie.year || "Full"}
          </span>
        </div>

        {/* Center Glowing Play Button on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-90 group-hover:scale-100 z-10">
          <div className="w-12 h-12 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-[0_0_30px_rgba(229,0,0,0.7)] ring-4 ring-white/20">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Quick Add To Favorites (Heart) button */}
        <button
          type="button"
          onClick={handleToggleList}
          aria-label={inList ? "Xóa khỏi yêu thích" : "Thêm vào yêu thích"}
          title={inList ? "Đã lưu vào danh sách yêu thích" : "Thêm vào yêu thích"}
          className={cn(
            "absolute bottom-2.5 right-2.5 z-20 w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md transition-all duration-300 border shadow-md cursor-pointer",
            inList
              ? "bg-[#E50000] text-[#F9FAFB] border-[#E50000] shadow-[#E50000]/50 scale-100 opacity-100"
              : "bg-[#0F0F0F]/85 text-[#D1D5DB] border-[#2E2E2E] hover:bg-[#F9FAFB] hover:text-[#E50000] hover:border-[#F9FAFB] hover:scale-110 opacity-80 sm:opacity-0 sm:group-hover:opacity-100",
            justToggled && "scale-125"
          )}
        >
          {/* Animated Heart Icon */}
          <Heart
            className={cn(
              "w-4 h-4 transition-all duration-300",
              inList
                ? "fill-[#F9FAFB] text-[#F9FAFB] drop-shadow"
                : "text-[#F9FAFB] fill-transparent group-hover:fill-[#E50000] group-hover:text-[#E50000]",
              justToggled && "scale-125 animate-pulse"
            )}
          />

          {/* Burst ring animation when clicked */}
          {justToggled && (
            <span className="absolute inset-0 rounded-full border-2 border-[#E50000] animate-ping pointer-events-none" />
          )}
        </button>

        {/* Floating Mini Toast when toggling favorite */}
        {justToggled && (
          <div className="absolute bottom-12 right-2 z-30 px-2.5 py-1 rounded-lg bg-black/95 border border-white/20 text-[#F9FAFB] text-[10px] font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 pointer-events-none whitespace-nowrap flex items-center gap-1.5">
            <Heart
              className={cn(
                "w-3 h-3",
                inList ? "fill-[#E50000] text-[#E50000]" : "text-[#F9FAFB]"
              )}
            />
            <span>{inList ? "Đã thêm yêu thích!" : "Đã bỏ yêu thích"}</span>
          </div>
        )}

        {/* Continue Watching Progress Bar */}
        {typeof effectiveProgress === "number" && effectiveProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#262626] z-20">
            <div
              className="h-full bg-[#E50000] transition-all"
              style={{ width: `${effectiveProgress}%` }}
            />
          </div>
        )}
      </Link>

      {/* Card Bottom Details */}
      <div className="pt-3 flex flex-col justify-between gap-1.5">
        <div>
          <Link
            href={`/movie/${movie.slug}`}
            prefetch={true}
            className="font-extrabold text-xs sm:text-sm text-[#F9FAFB] tracking-[-0.02em] truncate hover:text-[#E50000] transition-colors block"
            title={primaryTitle}
          >
            {primaryTitle}
          </Link>
          <span
            className="text-[10px] sm:text-[11px] text-[#9CA3AF] font-normal italic truncate block mt-0.5"
            title={secondaryTitle}
          >
            {secondaryTitle}
          </span>
        </div>

        {/* Metadata Badges Container */}
        <div className="flex items-center justify-between gap-1 pt-2 border-t border-[#262626] text-xs">
          {/* Duration Badge */}
          <div className="flex items-center gap-1 bg-[#141414] border border-[#262626] rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-medium text-[#D1D5DB] truncate min-w-0">
            <Clock className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
            <span className="truncate">
              {movie.type === "series" ? movie.currentEpisode || "Phim bộ" : movie.duration || `${movie.year}`}
            </span>
          </div>

          {/* Rating Badge */}
          <div className="flex items-center gap-1 bg-[#141414] border border-[#262626] rounded-full px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold text-[#F9FAFB] flex-shrink-0">
            <Star className="w-3 h-3 fill-[#E50000] text-[#E50000]" />
            <span>{formatRating(movie.rating)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
