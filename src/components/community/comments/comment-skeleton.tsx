import { Skeleton } from "@/components/ui/skeleton";

export function CommentSkeleton() {
  return (
    <section
      aria-label="Đang tải bình luận"
      className="rounded-xl border border-cinema-800 bg-cinema-900/50 p-4 md:p-6 space-y-4"
    >
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="space-y-3 pt-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-cinema-800 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
