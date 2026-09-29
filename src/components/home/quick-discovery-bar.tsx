"use client";

import * as React from "react";
import Link from "next/link";
import {
  Flame,
  Clock,
  Film,
  Tv,
  Sword,
  Wand2,
  Rocket,
  Heart,
  Ghost,
  Compass,
} from "lucide-react";

interface CategoryPill {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isHot?: boolean;
}

const CATEGORY_PILLS: CategoryPill[] = [
  { label: "Thịnh Hành", href: "#trending", icon: Flame, isHot: true },
  { label: "Mới Cập Nhật", href: "#latest", icon: Clock },
  { label: "Phim Lẻ Chiếu Rạp", href: "/movies?type=single", icon: Film },
  { label: "Phim Bộ Đặc Sắc", href: "/series", icon: Tv },
  { label: "Hành Động", href: "/genre/hanh-dong", icon: Sword },
  { label: "Anime & Hoạt Hình", href: "/genre/hoat-hinh", icon: Wand2 },
  { label: "Viễn Tưởng", href: "/genre/vien-tuong", icon: Rocket },
  { label: "Tình Cảm", href: "/genre/tinh-cam", icon: Heart },
  { label: "Kinh Dị", href: "/genre/kinh-di", icon: Ghost },
  { label: "Tất Cả Phim", href: "/movies", icon: Compass },
];

export function QuickDiscoveryBar() {
  return (
    <div className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-4 sm:-mt-6 mb-8 select-none">
      <div className="p-2 sm:p-2.5 rounded-2xl bg-cinema-900/90 backdrop-blur-xl border border-white/[0.08] shadow-2xl shadow-black/80 flex items-center gap-2 overflow-x-auto scrollbar-none no-scrollbar">
        {CATEGORY_PILLS.map((pill) => {
          const Icon = pill.icon;
          return (
            <Link
              key={pill.label}
              href={pill.href}
              prefetch={true}
              className="flex-shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] hover:border-brand/40 transition-all duration-200 group whitespace-nowrap"
            >
              <Icon className="w-3.5 h-3.5 text-zinc-400 group-hover:text-brand transition-colors" />
              <span>{pill.label}</span>
              {pill.isHot && (
                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
