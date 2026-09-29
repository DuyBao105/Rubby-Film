"use client";

import * as React from "react";
import { Server, ChevronLeft, ChevronRight, FastForward } from "lucide-react";
import { VideoSource } from "@/types/movie";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ServerSelectorProps {
  sources: VideoSource[];
  activeSource: VideoSource;
  onSelectSource: (source: VideoSource) => void;
  isSeries?: boolean;
  hasPrevEpisode?: boolean;
  hasNextEpisode?: boolean;
  onPrevEpisode?: () => void;
  onNextEpisode?: () => void;
  autoNextEnabled?: boolean;
  onToggleAutoNext?: () => void;
  className?: string;
}

export function ServerSelector({
  sources,
  activeSource,
  onSelectSource,
  isSeries = false,
  hasPrevEpisode,
  hasNextEpisode,
  onPrevEpisode,
  onNextEpisode,
  autoNextEnabled = true,
  onToggleAutoNext,
  className,
}: ServerSelectorProps) {
  // Clean up server labels for clean, user-friendly presentation
  const getCleanServerName = (name: string, idx: number) => {
    let clean = name || `Server #${idx + 1}`;
    clean = clean.replace(/#Hà Nội/gi, "#1");
    clean = clean.replace(/#Sài Gòn/gi, "#2");
    clean = clean.replace(/#Đà Nẵng/gi, "#3");
    return clean;
  };

  return (
    <div
      className={cn(
        "flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-cinema-850/80 border border-cinema-700/70 shadow-lg backdrop-blur-md",
        className
      )}
    >
      {/* Server list */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-cinema-400 font-semibold mr-1">
          <Server className="w-4 h-4 text-brand" />
          <span>Nguồn phát:</span>
        </div>

        {sources.map((src, index) => {
          const isActive = src.serverName === activeSource.serverName;
          const label = getCleanServerName(src.serverName, index);

          return (
            <button
              key={`${src.serverName}-${index}`}
              type="button"
              onClick={() => onSelectSource(src)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border flex items-center gap-1.5",
                isActive
                  ? "bg-brand text-white border-brand shadow-sm shadow-brand/20 font-bold scale-[1.02]"
                  : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:bg-cinema-750 hover:text-white hover:border-cinema-600"
              )}
            >
              <span>{label}</span>
              {src.type === "embed" && (
                <span className={cn("text-[10px] px-1 rounded", isActive ? "bg-black/30 text-white/90" : "bg-cinema-700 text-cinema-300")}>
                  Embed
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Navigation & Auto-Next Toggle (Series only) */}
      {isSeries && (
        <div className="flex items-center gap-2.5 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-cinema-750">
          {/* Auto Next Switch */}
          {onToggleAutoNext && (
            <button
              type="button"
              onClick={onToggleAutoNext}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                autoNextEnabled
                  ? "bg-brand/10 border-brand/40 text-brand"
                  : "bg-cinema-800 border-cinema-700 text-cinema-400 hover:text-cinema-200"
              )}
              title="Tự động phát tập tiếp theo khi hết phim"
            >
              <FastForward className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tự chuyển tập:</span>
              <span className="font-bold">{autoNextEnabled ? "BẬT" : "TẮT"}</span>
            </button>
          )}

          {/* Episode quick navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onPrevEpisode}
              disabled={!hasPrevEpisode}
              className="text-xs h-9 border border-cinema-700 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              <span>Tập trước</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={onNextEpisode}
              disabled={!hasNextEpisode}
              className="text-xs h-9 border border-cinema-700 disabled:opacity-40"
            >
              <span>Tập tiếp</span>
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
