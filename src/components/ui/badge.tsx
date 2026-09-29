"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "brand" | "rating" | "quality" | "outline" | "secondary" | "subtle";
}

export function Badge({
  className,
  variant = "secondary",
  ...props
}: BadgeProps) {
  const variants = {
    brand: "bg-brand/15 text-brand border border-brand/30 font-medium",
    rating: "bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold",
    quality: "bg-cinema-700/80 text-cinema-100 border border-cinema-600 font-semibold uppercase tracking-wider text-[10px]",
    outline: "border border-cinema-600 text-cinema-300 bg-transparent",
    secondary: "bg-cinema-800 text-cinema-200 border border-cinema-700/50",
    subtle: "bg-cinema-850/80 text-cinema-300",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
