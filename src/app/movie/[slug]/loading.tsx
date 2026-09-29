import { Skeleton } from "@/components/ui/skeleton";

export default function MovieDetailLoading() {
  return (
    <div className="w-full min-h-screen bg-[#0F0F0F] text-white">
      {/* 1. Backdrop Skeleton */}
      <div className="relative w-full h-[280px] sm:h-[450px] md:h-[560px] lg:h-[68vh] xl:max-h-[750px] overflow-hidden bg-[#16161E]/50 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F0F] via-[#0F0F0F]/60 to-transparent" />
      </div>

      {/* 2. Foreground Details Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-32 sm:-mt-48 md:-mt-64 relative z-10">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          {/* Poster Skeleton */}
          <div className="shrink-0 w-44 sm:w-56 md:w-64 max-w-[280px] mx-auto md:mx-0">
            <div className="aspect-[2/3] w-full rounded-2xl bg-[#1A1A24] border border-white/10 shadow-2xl animate-pulse" />
          </div>

          {/* Info Details Skeleton */}
          <div className="flex-1 w-full space-y-4 pt-2">
            {/* Title */}
            <div className="h-8 sm:h-11 w-3/4 max-w-lg rounded-xl bg-white/10 animate-pulse" />
            <div className="h-4 sm:h-5 w-1/2 max-w-sm rounded bg-white/5 animate-pulse" />

            {/* Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              <div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
              <div className="h-6 w-20 rounded-full bg-white/10 animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-white/10 animate-pulse" />
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3 pt-4">
              <div className="h-12 w-36 rounded-xl bg-[#E50000]/60 animate-pulse" />
              <div className="h-12 w-32 rounded-xl bg-white/10 animate-pulse" />
            </div>

            {/* Description lines */}
            <div className="space-y-2 pt-6">
              <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
