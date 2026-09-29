"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "cinema";
  size?: "sm" | "md" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]";

    const variants = {
      primary:
        "bg-brand text-cinema-950 font-semibold hover:bg-brand-hover shadow-lg shadow-brand/20 hover:shadow-brand/35",
      cinema:
        "bg-white text-cinema-950 font-semibold hover:bg-cinema-100 shadow-md",
      secondary:
        "bg-cinema-800 text-cinema-100 hover:bg-cinema-700 hover:text-white border border-cinema-700/60",
      outline:
        "border border-cinema-600 text-cinema-200 hover:border-cinema-400 hover:text-white bg-transparent",
      ghost:
        "text-cinema-300 hover:text-white hover:bg-cinema-800/60",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs rounded-md gap-1.5",
      md: "h-10 px-4 text-sm rounded-lg gap-2",
      lg: "h-12 px-6 text-base rounded-lg gap-2.5",
      icon: "h-10 w-10 p-0 rounded-lg justify-center",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
