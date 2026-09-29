"use client";

import { cn } from "@/lib/utils";

export type CommentSort = "newest" | "oldest" | "top";

interface CommentSortControlProps {
  value: CommentSort;
  onChange: (sort: CommentSort) => void;
}

const OPTIONS: { value: CommentSort; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "top", label: "Nhiều lượt thích" },
];

export function CommentSortControl({ value, onChange }: CommentSortControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Sắp xếp bình luận"
      className="inline-flex items-center rounded-lg border border-cinema-800 bg-cinema-900/60 p-1 text-xs"
    >
      {OPTIONS.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "px-3 py-1.5 rounded-md font-medium transition-colors",
              active
                ? "bg-cinema-700 text-cinema-50 shadow-inner"
                : "text-cinema-400 hover:text-cinema-100 hover:bg-cinema-800/60",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
