"use client";

import { Star } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface RatingStarsProps {
  value: number;
  onChange?: (n: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

/**
 * Star input + display. Role=radio radiogroup, ↑↓/←→ adjust by 1,
 * number keys 1..5 jump directly. Hover/focus previews the value.
 */
export function RatingStars({ value, onChange, disabled, size = "md" }: RatingStarsProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const handle = React.useCallback(
    (n: number) => {
      if (disabled || !onChange) return;
      onChange(n);
    },
    [disabled, onChange],
  );
  const dim = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div
      role="radiogroup"
      aria-label="Đánh giá phim"
      className="flex items-center gap-1"
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (hover ?? value) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} sao`}
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(null)}
            onClick={() => handle(n)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                e.preventDefault();
                handle(Math.min(5, (hover ?? value) + 1));
              }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                e.preventDefault();
                handle(Math.max(1, (hover ?? value) - 1));
              }
              if (["1", "2", "3", "4", "5"].includes(e.key)) {
                e.preventDefault();
                handle(Number(e.key));
              }
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                handle(hover ?? value);
              }
            }}
            className={cn(
              "p-1 rounded transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-500",
              filled ? "text-cinema-500" : "text-cinema-700 hover:text-cinema-300",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <Star className={cn(dim, filled && "fill-current")} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
