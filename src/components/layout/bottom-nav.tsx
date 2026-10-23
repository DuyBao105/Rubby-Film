"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Home, Search, Film, History, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavTab {
  id: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
}

const TABS: NavTab[] = [
  {
    id: "home",
    href: "/",
    label: "Trang chủ",
    icon: Home,
    isActive: (p) => p === "/",
  },
  {
    id: "search",
    href: "/search",
    label: "Tìm kiếm",
    icon: Search,
    isActive: (p) => p === "/search" || p.startsWith("/search"),
  },
  {
    id: "movies",
    href: "/movies",
    label: "Kho Phim",
    icon: Film,
    isActive: (p) =>
      p === "/movies" ||
      p.startsWith("/movies") ||
      p === "/series" ||
      p.startsWith("/series") ||
      p.startsWith("/genre") ||
      p.startsWith("/country") ||
      p.startsWith("/year"),
  },
  {
    id: "history",
    href: "/history",
    label: "Lịch sử",
    icon: History,
    isActive: (p) => p === "/history" || p.startsWith("/history"),
  },
  {
    id: "my-list",
    href: "/my-list",
    label: "Danh sách",
    icon: Bookmark,
    isActive: (p) => p === "/my-list" || p.startsWith("/my-list"),
  },
];

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Clear pending optimistic state as soon as pathname synchronizes
  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Hide on auth pages (login, register, forgot-password)
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password";

  if (isAuthPage) {
    return null;
  }

  const currentPath = pendingHref ?? pathname;

  const handleTabClick = (tab: NavTab, e: React.MouseEvent) => {
    if (tab.isActive(pathname)) {
      e.preventDefault();
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }

    // Set optimistic tab state for instant zero-latency visual feedback
    setPendingHref(tab.href);
    router.push(tab.href);
  };

  const handlePrefetch = (href: string) => {
    try {
      router.prefetch(href);
    } catch {}
  };

  return (
    <nav
      suppressHydrationWarning
      aria-label="Điều hướng chính di động"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F0F0F]/95 backdrop-blur-2xl border-t border-[#262626] shadow-[0_-8px_30px_rgba(0,0,0,0.85)] select-none pointer-events-auto"
      style={{
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Radiant Top Red Ambient Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E50000]/40 to-transparent pointer-events-none" />

      <div className="grid grid-cols-5 items-center justify-around h-14 sm:h-16 px-1 w-full max-w-md mx-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.isActive(currentPath);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              prefetch={true}
              onClick={(e) => handleTabClick(tab, e)}
              onTouchStart={() => handlePrefetch(tab.href)}
              onMouseEnter={() => handlePrefetch(tab.href)}
              aria-label={tab.label}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full min-h-[48px] py-1 transition-all duration-200 group relative select-none touch-manipulation cursor-pointer",
                active
                  ? "text-[#E50000]"
                  : "text-[#9CA3AF] hover:text-[#F9FAFB] active:scale-95"
              )}
            >
              {active && (
                <span className="absolute top-0 w-8 h-[2px] bg-[#E50000] rounded-full shadow-[0_0_8px_#E50000] transition-all duration-200" />
              )}
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200 pointer-events-none",
                  active && "scale-110"
                )}
              />
              <span className="text-[10px] font-semibold tracking-tight mt-1 leading-none pointer-events-none">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
