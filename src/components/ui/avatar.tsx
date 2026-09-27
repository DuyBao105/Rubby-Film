"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface AvatarProps {
  src?: string;
  alt?: string;
  fallbackInitials?: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  xs: "w-6 h-6 text-[9px]",
  sm: "w-7 h-7 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

/** Round avatar with image + initials fallback (matches header dropdown pattern). */
export function Avatar({ src, alt, fallbackInitials, size = "md", className }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImg = src && !failed;
  return (
    <span
      className={cn(
        "relative inline-flex items-center justify-center rounded-full overflow-hidden select-none shrink-0",
        showImg
          ? "ring-1 ring-cinema-700"
          : "bg-brand/20 border border-brand/40 text-cinema-50 font-extrabold",
        SIZE[size],
        className,
      )}
      aria-hidden={alt ? undefined : true}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="tracking-wide">{fallbackInitials ?? "?"}</span>
      )}
    </span>
  );
}
