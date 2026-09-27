import { Skeleton } from "@/components/ui/skeleton";

export function RatingSkeleton() {
  return (
    <section
      aria-label="Đang tải đánh giá"
      className="rounded-xl border border-cinema-800 bg-cinema-900/50 p-4 md:p-6"
    >
      <Skeleton className="h-5 w-48 rounded mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
        <div className="text-center space-y-3">
          <Skeleton className="h-10 w-24 rounded mx-auto" />
          <Skeleton className="h-3 w-32 rounded mx-auto" />
          <Skeleton className="h-6 w-36 rounded mx-auto" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full rounded" />
          ))}
        </div>
      </div>
    </section>
  );
}
