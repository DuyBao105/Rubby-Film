"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Movie } from "@/types/movie";
import { MovieCard } from "./movie-card";

interface MovieRowProps {
  id?: string;
  title: string;
  subtitle?: string;
  movies: Movie[];
  viewAllHref?: string;
  className?: string;
}

export function MovieRow({
  id,
  title,
  subtitle,
  movies,
  viewAllHref,
  className,
}: MovieRowProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  React.useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [movies]);

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
    <section id={id} className={`py-6 relative group/row w-full ${className || ""}`}>
      <div className="max-w-7xl mx-auto">
        {/* StreamVibe Section Header */}
        <div className="flex items-end justify-between px-4 sm:px-6 lg:px-8 mb-4 sm:mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#F9FAFB] tracking-[-0.02em]">
              {title}
            </h2>
            {subtitle && (
              <p className="text-xs sm:text-sm text-[#D1D5DB] font-normal leading-[1.6] mt-1">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-xs sm:text-sm font-semibold text-[#D1D5DB] hover:text-[#F9FAFB] flex items-center gap-1 transition-colors mr-1"
              >
                <span>Xem tất cả</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}

            {/* StreamVibe Signature Navigation Controls Container */}
            <div className="hidden sm:flex items-center gap-2 bg-[#0F0F0F] border border-[#262626] rounded-xl p-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                aria-label="Cuộn sang trái"
                className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 px-1.5">
                <span className={`h-1 rounded-full transition-all ${!canScrollLeft ? "w-4 bg-[#E50000]" : "w-1.5 bg-[#333333]"}`} />
                <span className={`h-1 rounded-full transition-all ${canScrollLeft && canScrollRight ? "w-4 bg-[#E50000]" : "w-1.5 bg-[#333333]"}`} />
                <span className={`h-1 rounded-full transition-all ${!canScrollRight ? "w-4 bg-[#E50000]" : "w-1.5 bg-[#333333]"}`} />
              </div>
              <button
                type="button"
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                aria-label="Cuộn sang phải"
                className="w-9 h-9 rounded-lg bg-[#1A1A1A] hover:bg-[#262626] border border-[#262626] text-white flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row Carousel */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none px-4 sm:px-6 lg:px-8 pb-3 scroll-smooth no-scrollbar snap-x snap-mandatory touch-pan-x"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        >
          {movies.map((movie, index) => (
            <div
              key={movie.id}
              className="flex-shrink-0 w-[135px] sm:w-[180px] md:w-[205px] lg:w-[225px] snap-start"
            >
              <MovieCard movie={movie} priority={index < 4} />
            </div>
          ))}
          {/* End buffer for mobile scroll so last card isn't stuck to right edge */}
          <div className="w-4 sm:w-6 shrink-0" aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
