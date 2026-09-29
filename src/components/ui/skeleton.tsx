"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-cinema-800/80 relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-cinema-700/30 before:to-transparent",
        className
      )}
      {...props}
    />
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Skeleton className="w-full aspect-poster rounded-xl" />
      <Skeleton className="h-4 w-3/4 rounded mt-1" />
      <div className="flex gap-2">
        <Skeleton className="h-3 w-12 rounded" />
        <Skeleton className="h-3 w-10 rounded" />
      </div>
    </div>
  );
}

export function MovieRowSkeleton({ title }: { title?: string }) {
  return (
    <div className="py-6 space-y-4">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {title ? (
          <h2 className="text-xl font-bold text-white">{title}</h2>
        ) : (
          <Skeleton className="h-7 w-48 rounded" />
        )}
      </div>
      <div className="flex gap-4 overflow-hidden px-4 sm:px-6 lg:px-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-w-[170px] sm:min-w-[200px] w-[170px] sm:w-[200px]">
            <MovieCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
