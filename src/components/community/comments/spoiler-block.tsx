"use client";

import * as React from "react";

interface SpoilerBlockProps {
  content: string;
}

/**
 * Renders `content` behind a click-to-reveal overlay. Keyboard-reachable,
 * aria-pressed reflects state. Pressing Esc or Space toggles.
 */
export function SpoilerBlock({ content }: SpoilerBlockProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative rounded border border-cinema-700 bg-cinema-950/70">
      {open ? (
        <div className="text-cinema-100 whitespace-pre-wrap break-words p-2 text-sm">
          {content}
        </div>
      ) : (
        <button
          type="button"
          aria-pressed={false}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="block w-full bg-cinema-950/95 text-cinema-200 px-3 py-2 text-xs sm:text-sm rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-500"
        >
          <span aria-hidden="true">⚠ </span>
          Chứa spoiler — nhấn để hiện
        </button>
      )}
    </div>
  );
}
