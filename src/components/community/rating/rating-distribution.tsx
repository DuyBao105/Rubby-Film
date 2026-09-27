"use client";

import { cn } from "@/lib/utils";

interface RatingDistributionProps {
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  count: number;
  onJumpTo?: (stars: number) => void;
}

/** 5→1 horizontal bar chart. Each row clickable (when wired) to filter. */
export function RatingDistribution({ distribution, count, onJumpTo }: RatingDistributionProps) {
  if (count === 0) {
    return <p className="text-cinema-400 text-sm">Chưa có đánh giá nào.</p>;
  }
  return (
    <div className="space-y-1.5" aria-label="Phân bố đánh giá">
      {[5, 4, 3, 2, 1].map((s) => {
        const n = distribution[s as 1 | 2 | 3 | 4 | 5] ?? 0;
        const pct = Math.round((n / count) * 100);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onJumpTo?.(s)}
            className={cn(
              "grid grid-cols-[40px_1fr_60px] items-center gap-2 text-xs w-full hover:bg-cinema-900/40 rounded px-1 py-0.5 transition-colors",
            )}
          >
            <span className="text-cinema-200">{s} sao</span>
            <div
              className="h-2 bg-cinema-800 rounded overflow-hidden"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${n} lượt đánh ${s} sao`}
            >
              <div className="h-full bg-cinema-500" style={{ width: `${pct}%` }} aria-hidden="true" />
            </div>
            <span className="text-cinema-400 text-right tabular-nums">{n}</span>
          </button>
        );
      })}
    </div>
  );
}
