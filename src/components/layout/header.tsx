"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  Heart,
  History,
  Menu,
  X,
  ChevronDown,
  Film,
  Flame,
  Clock,
  Tv,
  Clapperboard,
  User,
  LogIn,
  LogOut,
  Settings,
  ArrowLeft,
  ChevronRight,
  Home,
  Globe,
  Sparkles,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Genre, Country } from "@/types/movie";
import { SearchOverlay } from "@/components/search/search-overlay";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useAuth } from "@/lib/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { checkAndNotifyDueReminders } from "@/lib/utils/airingSchedule";

interface HeaderProps {
  genres?: Genre[];
  countries?: Country[];
}

export function Header({ genres = [], countries = [] }: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { list, isLoaded } = useMyList();
  const toast = useToast();

  // Sitewide episode reminder checker
  React.useEffect(() => {
    const notifyHandler = () => {
      checkAndNotifyDueReminders((dueRem) => {
        toast.success(
          "🎉 Tập mới đã lên sóng!",
          `Tập ${dueRem.episodeNumber} của "${dueRem.movieTitle || "phim bạn theo dõi"}" đã sẵn sàng. Xem ngay!`
        );
      });
    };

    notifyHandler();
    const interval = setInterval(notifyHandler, 30000);
    return () => clearInterval(interval);
  }, [toast]);

  const [isScrolled, setIsScrolled] = React.useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [genreDropdownOpen, setGenreDropdownOpen] = React.useState(false);
  const [countryDropdownOpen, setCountryDropdownOpen] = React.useState(false);

  const { user, isAuthenticated, isLoading: isAuthLoading, logout, openAuthModal } = useAuth();
  const [mounted, setMounted] = React.useState(false);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isAuthed = mounted && Boolean(user);

  // Click outside to close user dropdown
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  // Detect scroll to toggle transparent vs dark translucent background
  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut Ctrl+K to open search
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile menu and dropdowns on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
    setGenreDropdownOpen(false);
    setCountryDropdownOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  const searchParams = useSearchParams();
  const currentTypeParam = searchParams.get("type");

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleHomeClick = (e?: React.MouseEvent) => {
    const isAtHome =
      pathname === "/" ||
      (typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === ""));
    if (isAtHome) {
      if (e) {
        e.preventDefault();
      }
      scrollToTop();
    }
  };

  const navLinks = [
    { label: "Trang Chủ", href: "/" },
    { label: "Phim Lẻ", href: "/movies?type=single" },
    { label: "Phim Bộ", href: "/series" },
    { label: "Thịnh Hành", href: "/trending" },
    { label: "Mới Nhất", href: "/latest" },
  ];

  const defaultGenres = [
    { name: "Hành động", slug: "hanh-dong" },
    { name: "Viễn tưởng", slug: "vien-tuong" },
    { name: "Tình cảm", slug: "tinh-cam" },
    { name: "Hoạt hình", slug: "hoat-hinh" },
    { name: "Kinh dị", slug: "kinh-di" },
    { name: "Tâm lý", slug: "tam-ly" },
  ];

  const defaultCountries = [
    { name: "Âu Mỹ", slug: "au-my" },
    { name: "Hàn Quốc", slug: "han-quoc" },
    { name: "Nhật Bản", slug: "nhat-ban" },
    { name: "Trung Quốc", slug: "trung-quoc" },
    { name: "Việt Nam", slug: "viet-nam" },
  ];

  const displayGenres = genres.length > 0 ? genres : defaultGenres;
  const displayCountries = countries.length > 0 ? countries : defaultCountries;

  const isHeroPage = pathname === "/" || pathname.startsWith("/movie/");
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

  if (isAuthPage) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 py-4 px-4 sm:px-8 bg-gradient-to-b from-[#080808]/90 via-[#080808]/50 to-transparent pointer-events-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-baseline group select-none">
            <span suppressHydrationWarning className="font-black text-2xl sm:text-3xl tracking-[-0.03em] text-[#F9FAFB] group-hover:opacity-90 transition-opacity">
              RUBY
            </span>
            <span suppressHydrationWarning className="font-extrabold text-xs sm:text-sm tracking-widest text-[#E50000] ml-1.5 uppercase">
              FILM
            </span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-white/[0.06]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Trang Chủ</span>
            </Link>

            {pathname === "/login" ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-[#9CA3AF]">Chưa có tài khoản?</span>
                <Link
                  href="/register"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#E50000] hover:bg-[#FF1A1A] transition-all shadow-md shadow-[#E50000]/25 hover:scale-[1.02] active:scale-[0.98]"
                >
                  Đăng Ký
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-[#9CA3AF]">Đã có tài khoản?</span>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-[#F9FAFB] bg-white/10 hover:bg-white/15 border border-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Đăng Nhập
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 py-3 transition-colors">
        {/* Layer 1: Ambient top gradient overlay for Hero header */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out",
            isHeroPage && !isScrolled
              ? "opacity-100 bg-gradient-to-b from-[#0F0F0F]/95 via-[#0F0F0F]/60 to-transparent"
              : "opacity-0"
          )}
        />

        {/* Layer 2: Scrolled solid dark blur background with border & shadow (smooth opacity fade-in) */}
        <div
          className={cn(
            "absolute inset-0 pointer-events-none transition-opacity duration-300 ease-out bg-[#0F0F0F]/95 backdrop-blur-xl border-b border-[#262626] shadow-2xl",
            isScrolled || !isHeroPage || isMobileMenuOpen ? "opacity-100" : "opacity-0"
          )}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Left: RubyFilm Brand Logo */}
            <Link
              href="/"
              onClick={handleHomeClick}
              className="flex items-baseline select-none flex-shrink-0 group py-1 transition-opacity hover:opacity-90"
              title="Về đầu trang"
            >
              <span suppressHydrationWarning className="font-extrabold text-2xl sm:text-3xl tracking-[-0.02em] text-[#F9FAFB]">
                RUBY
              </span>
              <span suppressHydrationWarning className="font-extrabold text-sm sm:text-base tracking-wider text-[#E50000] ml-1 uppercase">
                FILM
              </span>
            </Link>

            {/* Center: StreamVibe Signature Capsule Navigation Bar */}
            <nav className="hidden lg:flex items-center gap-1 bg-[#0F0F0F] border border-[#262626] rounded-2xl p-1.5 shadow-inner font-sans">
              {navLinks.map((link) => {
                let isActive = false;
                if (link.href === "/") {
                  isActive = pathname === "/";
                } else if (link.href === "/movies?type=single") {
                  isActive = pathname === "/movies" && (currentTypeParam === "single" || !currentTypeParam);
                } else if (link.href === "/series") {
                  isActive = pathname.startsWith("/series") || (pathname === "/movies" && currentTypeParam === "series");
                } else {
                  isActive = pathname.startsWith(link.href);
                }

                const tabClass = cn(
                  "px-4 py-2 rounded-xl text-sm font-sans font-medium whitespace-nowrap border transition-colors duration-150",
                  isActive
                    ? "bg-[#1A1A1A] text-white border-[#2E2E2E] shadow-sm"
                    : "text-[#9CA3AF] hover:text-white border-transparent hover:bg-white/[0.04]"
                );

                if (link.href === "/") {
                  return (
                    <Link
                      key={link.href}
                      href="/"
                      prefetch={true}
                      onClick={handleHomeClick}
                      className={tabClass}
                    >
                      {link.label}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    className={tabClass}
                  >
                    {link.label}
                  </Link>
                );
              })}

              {/* Genres Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setGenreDropdownOpen(true)}
                onMouseLeave={() => setGenreDropdownOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-sans font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-white/[0.04] transition-colors whitespace-nowrap",
                    genreDropdownOpen && "text-[#F9FAFB] bg-[#1A1A1A]"
                  )}
                >
                  <span>Thể Loại</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform duration-200", genreDropdownOpen && "rotate-180")} />
                </button>

                {genreDropdownOpen && (
                  <div className="absolute top-full left-0 pt-2 z-50">
                    <div className="w-80 rounded-2xl bg-[#0F0F0F] border border-[#262626] shadow-2xl p-3 grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                      {displayGenres.map((g) => (
                        <Link
                          key={g.slug}
                          href={`/genre/${g.slug}`}
                          prefetch={true}
                          className="px-2 py-1.5 rounded-lg text-xs text-[#D1D5DB] hover:text-[#E50000] hover:bg-[#1A1A1A] transition-colors font-medium text-center truncate"
                        >
                          {g.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Countries Dropdown */}
              <div
                className="relative"
                onMouseEnter={() => setCountryDropdownOpen(true)}
                onMouseLeave={() => setCountryDropdownOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 px-4 py-2 rounded-xl text-sm font-sans font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-white/[0.04] transition-colors whitespace-nowrap",
                    countryDropdownOpen && "text-[#F9FAFB] bg-[#1A1A1A]"
                  )}
                >
                  <span>Quốc Gia</span>
                  <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform duration-200", countryDropdownOpen && "rotate-180")} />
                </button>

                {countryDropdownOpen && (
                  <div className="absolute top-full right-0 pt-2 z-50">
                    <div className="w-80 rounded-2xl bg-[#0F0F0F] border border-[#262626] shadow-2xl p-3 grid grid-cols-3 gap-1.5 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                      {displayCountries.map((c) => (
                        <Link
                          key={c.slug}
                          href={`/country/${c.slug}`}
                          prefetch={true}
                          className="px-2 py-1.5 rounded-lg text-xs text-[#D1D5DB] hover:text-[#E50000] hover:bg-[#1A1A1A] transition-colors font-medium text-center truncate"
                        >
                          {c.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </nav>

            {/* Right: StreamVibe Action Buttons */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
              {/* Search Trigger */}
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-[#0F0F0F] border border-[#262626] text-white flex items-center justify-center hover:border-[#E50000] hover:text-[#E50000] transition-all shadow-sm"
                aria-label="Tìm kiếm phim"
              >
                <Search className="w-4 h-4" />
              </button>


              {/* User Authentication Status / Avatar Menu */}
              {isAuthed && user ? (
                <div className="relative" ref={userMenuRef} suppressHydrationWarning>
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#141414] border border-[#2E2E2E] hover:border-[#FECF59]/50 transition-all cursor-pointer group"
                    aria-label="Menu tài khoản"
                  >
                    {user.avatarUrl ? (
                      <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden ring-1 ring-[#3A3A3A] group-hover:ring-[#FECF59] transition-all">
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#E50000]/20 border border-[#E50000]/40 flex items-center justify-center text-[#F9FAFB] font-extrabold text-xs">
                        {user.name ? user.name.slice(0, 2).toUpperCase() : "TV"}
                      </div>
                    )}
                    <span className="hidden xl:inline-block max-w-[110px] truncate text-xs font-bold text-[#F9FAFB] group-hover:text-[#FECF59] transition-colors">
                      {user.name}
                    </span>
                    <ChevronDown className={cn("hidden sm:block w-3.5 h-3.5 text-[#9CA3AF] transition-transform duration-200", userMenuOpen && "rotate-180")} />
                  </button>

                  {/* Dropdown Menu */}
                  {userMenuOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 rounded-2xl bg-[#141414] border border-[#2E2E2E] shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Header Info */}
                      <div className="p-3 rounded-xl bg-[#1C1C1C] border border-[#2A2A2A] mb-2">
                        <div className="flex items-center gap-2.5">
                          {user.avatarUrl ? (
                            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
                              <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#E50000]/20 border border-[#E50000]/40 flex items-center justify-center text-[#F9FAFB] font-extrabold text-xs shrink-0">
                              {user.name ? user.name.slice(0, 2).toUpperCase() : "TV"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-extrabold text-[#F9FAFB] truncate">{user.name}</p>
                            <p className="text-[10px] text-[#9CA3AF] truncate">{user.email}</p>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-[#2A2A2A] flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#FECF59] bg-[#FECF59]/10 px-2 py-0.5 rounded-full border border-[#FECF59]/20">
                            {user.role === "vip" ? "★ Thành Viên VIP" : "Thành Viên"}
                          </span>
                          <span className="text-[10px] text-[#9CA3AF]">
                            {user.providers?.includes("google") ? "Google" : user.providers?.includes("facebook") ? "Facebook" : "Email"}
                          </span>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="space-y-0.5">
                        <Link
                          href="/profile"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-[#222222] transition-colors"
                        >
                          <User className="w-4 h-4 text-[#FECF59]" />
                          <span>Trang cá nhân</span>
                        </Link>
                        <Link
                          href="/profile?tab=mylist"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-[#222222] transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <Heart className="w-4 h-4 text-[#E50000]" />
                            <span>Phim yêu thích</span>
                          </div>
                          {isLoaded && list.length > 0 && (
                            <span className="text-[10px] bg-[#E50000] text-white font-bold px-1.5 py-0.2 rounded-full">
                              {list.length}
                            </span>
                          )}
                        </Link>
                        <Link
                          href="/profile?tab=history"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-[#222222] transition-colors"
                        >
                          <History className="w-4 h-4 text-[#FECF59]" />
                          <span>Lịch sử xem</span>
                        </Link>
                        {user.role === "admin" && (
                          <Link
                            href="/admin/moderation"
                            onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#D1D5DB] hover:text-[#F9FAFB] hover:bg-[#222222] transition-colors"
                          >
                            <Shield className="w-4 h-4 text-[#E50000]" />
                            <span>Kiểm duyệt</span>
                          </Link>
                        )}
                      </div>

                      <div className="my-1.5 border-t border-[#262626]" />

                      {/* Logout Button */}
                      <button
                        type="button"
                        onClick={async () => {
                          setUserMenuOpen(false);
                          await logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#E50000] hover:bg-[#E50000]/10 transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Đăng xuất</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  suppressHydrationWarning
                  onClick={() => openAuthModal("login")}
                  className="hidden sm:inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#222222] border border-[#2E2E2E] hover:border-[#E50000]/60 text-[#F9FAFB] hover:text-[#E50000] font-bold text-xs sm:text-sm transition-all hover:scale-105 active:scale-95 shadow-sm group cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#E50000] group-hover:translate-x-0.5 transition-transform" />
                  <span>Đăng Nhập</span>
                </button>
              )}

              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={cn(
                  "lg:hidden w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200 cursor-pointer",
                  isMobileMenuOpen
                    ? "bg-[#1A1A1A] border-[#E50000] text-[#E50000] shadow-sm shadow-[#E50000]/20"
                    : "bg-[#0F0F0F] border-[#262626] text-white hover:border-[#E50000] hover:text-[#E50000]"
                )}
                aria-label={isMobileMenuOpen ? "Đóng menu điều hướng" : "Mở menu điều hướng"}
                aria-expanded={isMobileMenuOpen}
              >
                {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden relative bg-[#0F0F0F]/98 backdrop-blur-2xl border-b border-[#262626] px-4 pt-4 pb-6 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl animate-in slide-in-from-top-2 duration-300">
            {/* Ambient top-right glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#E50000]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Mobile Auth Section */}
            {!isAuthed ? (
              <div className="relative z-10 p-3.5 mb-3 rounded-2xl bg-gradient-to-r from-[#171717] via-[#141414] to-[#121212] border border-[#2A2A2A] flex items-center justify-between gap-3 shadow-md">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E50000] animate-pulse" />
                    <p className="text-xs font-black text-white tracking-wide">Tài khoản RubyFilm</p>
                  </div>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5 truncate">Đăng nhập để đồng bộ yêu thích & lịch sử</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openAuthModal("login");
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white font-bold text-xs shadow-md shadow-[#E50000]/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    Đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      openAuthModal("register");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[#E5E5E5] hover:text-white font-semibold text-xs transition-all active:scale-95 cursor-pointer"
                  >
                    Đăng ký
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 mb-3 rounded-2xl bg-[#141414] border border-[#2E2E2E] shadow-sm">
                {/* Profile Card Header Link */}
                <Link
                  href="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between group p-1 -m-1 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {user?.avatarUrl ? (
                      <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 ring-1 ring-[#3A3A3A] group-hover:ring-[#FECF59] transition-all">
                        <Image src={user.avatarUrl} alt={user.name} fill sizes="36px" className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#E50000]/20 border border-[#E50000]/40 flex items-center justify-center text-[#F9FAFB] font-extrabold text-xs shrink-0">
                        {user?.name ? user.name.slice(0, 2).toUpperCase() : "TV"}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-[#F9FAFB] group-hover:text-[#FECF59] transition-colors truncate">
                        {user?.name}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] uppercase font-bold text-[#FECF59] bg-[#FECF59]/10 px-1.5 py-0.5 rounded border border-[#FECF59]/20">
                      {user?.role === "vip" ? "★ VIP" : "Thành Viên"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#FECF59] transition-colors" />
                  </div>
                </Link>

                {/* Quick actions: Favorites & History */}
                <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-[#262626]">
                  <Link
                    href="/my-list"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] border border-[#2E2E2E] text-xs font-medium text-[#D1D5DB] hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <Heart className="w-3.5 h-3.5 text-[#E50000] fill-[#E50000]" />
                      <span>Yêu thích</span>
                    </div>
                    {isLoaded && list.length > 0 && (
                      <span className="text-[10px] bg-[#E50000] text-white font-extrabold px-1.5 py-0.2 rounded-full">
                        {list.length}
                      </span>
                    )}
                  </Link>

                  <Link
                    href="/history"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#1C1C1C] hover:bg-[#252525] border border-[#2E2E2E] text-xs font-medium text-[#D1D5DB] hover:text-white transition-colors"
                  >
                    <History className="w-3.5 h-3.5 text-[#FECF59]" />
                    <span>Lịch sử xem</span>
                  </Link>
                </div>

                {/* Footer Settings & Logout */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#262626]/70">
                  <Link
                    href="/settings"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Cài đặt tài khoản</span>
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMobileMenuOpen(false);
                      await logout();
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E50000] hover:text-[#FF4D4D] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}

            <nav className="relative z-10 flex flex-col gap-1.5 pt-1">
              {navLinks.map((link) => {
                let isActive = false;
                if (link.href === "/") {
                  isActive = pathname === "/";
                } else if (link.href === "/movies?type=single") {
                  isActive = pathname === "/movies" && (currentTypeParam === "single" || !currentTypeParam);
                } else if (link.href === "/series") {
                  isActive = pathname.startsWith("/series") || (pathname === "/movies" && currentTypeParam === "series");
                } else {
                  isActive = pathname.startsWith(link.href);
                }

                const renderIcon = () => {
                  if (link.href === "/") return <Home className="w-4 h-4" />;
                  if (link.href === "/movies?type=single") return <Film className="w-4 h-4" />;
                  if (link.href === "/series") return <Tv className="w-4 h-4" />;
                  if (link.href === "/trending") return <Flame className="w-4 h-4 text-[#FF4D4D]" />;
                  return <Sparkles className="w-4 h-4 text-[#FECF59]" />;
                };

                const linkClasses = cn(
                  "group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150",
                  isActive
                    ? "bg-gradient-to-r from-[#E50000]/20 via-[#1C1C1C] to-[#141414] text-white border border-[#E50000]/40 shadow-sm"
                    : "text-[#B3B3B3] hover:text-white hover:bg-white/[0.04] border border-transparent"
                );

                const iconWrapperClasses = cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors shrink-0",
                  isActive
                    ? "bg-[#E50000] text-white shadow-sm shadow-[#E50000]/40"
                    : "bg-[#181818] text-[#888888] group-hover:text-white group-hover:bg-[#222222]"
                );

                if (link.href === "/") {
                  return (
                    <Link
                      key={link.href}
                      href="/"
                      onClick={(e) => {
                        setIsMobileMenuOpen(false);
                        handleHomeClick(e);
                      }}
                      className={linkClasses}
                    >
                      <div className="flex items-center gap-3">
                        <span className={iconWrapperClasses}>
                          {renderIcon()}
                        </span>
                        <span>{link.label}</span>
                      </div>
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E50000] shadow-[0_0_8px_rgba(229,0,0,0.9)]" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#999] group-hover:translate-x-0.5 transition-all" />
                      )}
                    </Link>
                  );
                }

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch={true}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={linkClasses}
                  >
                    <div className="flex items-center gap-3">
                      <span className={iconWrapperClasses}>
                        {renderIcon()}
                      </span>
                      <span>{link.label}</span>
                      {link.href === "/trending" && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-[#E50000]/20 text-[#FF4D4D] border border-[#E50000]/30 animate-pulse">
                          HOT
                        </span>
                      )}
                    </div>
                    {isActive ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E50000] shadow-[0_0_8px_rgba(229,0,0,0.9)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#444] group-hover:text-[#999] group-hover:translate-x-0.5 transition-all" />
                    )}
                  </Link>
                );
              })}

              <div className="my-3 border-t border-[#222222]" />

              {/* Popular Genres */}
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                  <Clapperboard className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>Thể Loại Phim</span>
                </div>
                <Link
                  href="/movies"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-[10px] font-medium text-[#777] hover:text-[#E50000] transition-colors"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5 px-0.5 mb-3">
                {displayGenres.slice(0, 9).map((g) => (
                  <Link
                    key={g.slug}
                    href={`/genre/${g.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-2 py-2 rounded-xl text-xs text-[#B8B8B8] hover:text-white bg-[#141414] hover:bg-[#1E1E1E] border border-[#242424] hover:border-[#E50000]/50 transition-all duration-200 truncate text-center font-medium active:scale-95 shadow-sm"
                  >
                    {g.name}
                  </Link>
                ))}
              </div>

              {/* Popular Countries */}
              <div className="flex items-center justify-between px-1 mb-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider">
                  <Globe className="w-3.5 h-3.5 text-[#E50000]" />
                  <span>Quốc Gia</span>
                </div>
                <Link
                  href="/movies"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="text-[10px] font-medium text-[#777] hover:text-[#E50000] transition-colors"
                >
                  Xem tất cả →
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-1.5 px-0.5 pb-2">
                {displayCountries.slice(0, 6).map((c) => (
                  <Link
                    key={c.slug}
                    href={`/country/${c.slug}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-2 py-2 rounded-xl text-xs text-[#B8B8B8] hover:text-white bg-[#141414] hover:bg-[#1E1E1E] border border-[#242424] hover:border-[#E50000]/50 transition-all duration-200 truncate text-center font-medium active:scale-95 shadow-sm"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Backdrop for Mobile Menu */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Global Search Overlay */}
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
