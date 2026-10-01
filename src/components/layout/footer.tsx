"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, MessageCircle, ChevronRight, ShieldCheck, Zap, Sparkles, Download } from "lucide-react";
import { triggerPwaInstall } from "@/components/common/pwa-install-prompt";

export function Footer() {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/forgot-password";

  const [showFloatingScroll, setShowFloatingScroll] = React.useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowFloatingScroll(window.scrollY > 400);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  if (isAuthPage) {
    return null;
  }

  return (
    <footer className="relative bg-[#0A0A0A] border-t border-[#1F1F1F] text-cinema-400 text-xs select-none overflow-hidden">
      {/* Radiant Top Glow Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#E50000]/60 to-transparent" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-12 bg-[#E50000]/10 blur-2xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-8 sm:pb-12">
        {/* Top Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 mb-10 sm:mb-14">

          {/* Col 1: Brand Info & Social Connect (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-5">
            {/* Logo */}
            <Link
              href="/"
              onClick={handleHomeClick}
              className="inline-flex items-baseline select-none group transition-opacity hover:opacity-90"
              title="Về đầu trang"
            >
              <span suppressHydrationWarning className="font-extrabold text-2xl sm:text-3xl tracking-[-0.02em] text-[#F9FAFB]">
                RUBY
              </span>
              <span suppressHydrationWarning className="font-extrabold text-sm sm:text-base tracking-wider text-[#E50000] ml-1 uppercase">
                FILM
              </span>
            </Link>

            <p className="text-[#9CA3AF] text-xs sm:text-sm font-normal leading-relaxed max-w-sm">
              RubyFilm là nền tảng xem phim trực tuyến hiện đại, đem lại trải nghiệm điện ảnh chuẩn 4K HDR cùng tốc độ tải mượt mà, giao diện tinh tế trên mọi thiết bị hoàn toàn miễn phí.
            </p>

            {/* Quality Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#262626] text-[11px] font-semibold text-[#D1D5DB]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Tốc Độ Cao
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#262626] text-[11px] font-semibold text-amber-400">
                Chuẩn 4K HDR
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141414] border border-[#262626] text-[11px] font-semibold text-rose-400">
                Miễn Phí 100%
              </span>
            </div>

            {/* Social Media Connect Buttons */}
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2.5">
                Kênh Mạng Xã Hội
              </div>
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Facebook */}
                <a
                  href="https://www.facebook.com/duybao105/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141414] border border-[#262626] hover:border-[#1877F2] hover:text-[#1877F2] hover:bg-[#1877F2]/10 text-cinema-300 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm group"
                  title="Facebook cá nhân Duy Bảo"
                  aria-label="Facebook"
                >
                  <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/yud_oabie/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141414] border border-[#262626] hover:border-[#E1306C] hover:text-[#E1306C] hover:bg-[#E1306C]/10 text-cinema-300 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm group"
                  title="Instagram cá nhân yud_oabie"
                  aria-label="Instagram"
                >
                  <svg className="w-4 h-4 fill-none stroke-current stroke-2 transition-transform group-hover:scale-110" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                  </svg>
                </a>

                {/* Telegram */}
                <a
                  href="https://t.me/Duy_Bao105"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#141414] border border-[#262626] hover:border-[#229ED9] hover:text-[#229ED9] hover:bg-[#229ED9]/10 text-cinema-300 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm group"
                  title="Telegram hỗ trợ @Duy_Bao105"
                  aria-label="Telegram"
                >
                  <svg className="w-4 h-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Col 2 & 3: Navigation Links & Genres (Parallel 2 columns on mobile) */}
          <div className="lg:col-span-4 grid grid-cols-2 gap-4 sm:gap-6">
            {/* Navigation Links */}
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-3 sm:mb-4 pb-1.5 border-b border-[#222]">
                Khám Phá
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link
                    href="/"
                    onClick={handleHomeClick}
                    className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5"
                  >
                    Trang Chủ
                  </Link>
                </li>
                <li>
                  <Link href="/movies?type=single" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Phim Lẻ
                  </Link>
                </li>
                <li>
                  <Link href="/series" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Phim Bộ
                  </Link>
                </li>
                <li>
                  <Link href="/trending" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-flex items-center gap-1.5 py-0.5">
                    <span>Thịnh Hành</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#E50000]/20 text-[#E50000]">HOT</span>
                  </Link>
                </li>
                <li>
                  <Link href="/latest" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Mới Cập Nhật
                  </Link>
                </li>
              </ul>
            </div>

            {/* Popular Genres */}
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-3 sm:mb-4 pb-1.5 border-b border-[#222]">
                Thể Loại Hot
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/genre/hanh-dong" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Hành Động
                  </Link>
                </li>
                <li>
                  <Link href="/genre/vien-tuong" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Viễn Tưởng
                  </Link>
                </li>
                <li>
                  <Link href="/genre/hoat-hinh" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Hoạt Hình & Anime
                  </Link>
                </li>
                <li>
                  <Link href="/genre/tinh-cam" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Tình Cảm
                  </Link>
                </li>
                <li>
                  <Link href="/genre/kinh-di" className="text-[#9CA3AF] hover:text-white font-medium transition-colors inline-block py-0.5">
                    Kinh Dị
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Col 4: Countries & Support Box (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-5">
            <div>
              <h4 className="text-xs font-bold text-white tracking-wider uppercase mb-3 sm:mb-4 pb-1.5 border-b border-[#222]">
                Quốc Gia Tuyển Chọn
              </h4>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  { name: "Hàn Quốc", slug: "han-quoc" },
                  { name: "Trung Quốc", slug: "trung-quoc" },
                  { name: "Âu Mỹ", slug: "au-my" },
                  { name: "Nhật Bản", slug: "nhat-ban" },
                  { name: "Thái Lan", slug: "thai-lan" },
                ].map((c) => (
                  <Link
                    key={c.slug}
                    href={`/country/${c.slug}`}
                    className="px-2.5 py-1 rounded-lg bg-[#141414] border border-[#242424] hover:border-[#E50000] text-[#D1D5DB] hover:text-white transition-colors text-xs font-medium active:scale-95"
                  >
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* 24/7 Telegram Direct Support Card */}
            <a
              href="https://t.me/Duy_Bao105"
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#141414] via-[#161616] to-[#121212] border border-[#262626] hover:border-[#229ED9]/60 hover:shadow-[0_10px_25px_rgba(34,158,217,0.15)] transition-all duration-300 group active:scale-[0.99]"
            >
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#229ED9]/20 text-[#229ED9] flex items-center justify-center">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-[#F9FAFB] group-hover:text-[#229ED9] transition-colors">
                    Hỗ Trợ Trực Tuyến 24/7
                  </span>
                </div>
                <span className="text-[10px] font-semibold text-[#9CA3AF] group-hover:text-[#F9FAFB] transition-colors">
                  @Duy_Bao105 ›
                </span>
              </div>
              <p className="text-[11px] text-[#9CA3AF] font-normal leading-relaxed">
                Gặp lỗi phát phim, yêu cầu thêm phim mới hoặc đóng góp ý kiến? Hãy nhắn tin trực tiếp qua Telegram.
              </p>
            </a>

            {/* PWA App Install Button */}
            <button
              type="button"
              onClick={() => triggerPwaInstall()}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-[#141414] via-[#161616] to-[#121212] border border-[#262626] hover:border-[#E50000]/60 hover:shadow-[0_10px_25px_rgba(229,0,0,0.15)] text-left transition-all duration-300 group active:scale-[0.99] cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#E50000]/15 text-[#FF4D4D] flex items-center justify-center shrink-0 border border-[#E50000]/30">
                  <Download className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white group-hover:text-[#FF4D4D] transition-colors flex items-center gap-1.5">
                    <span>Cài Đặt RubyFilm App</span>
                    <span className="text-[9px] font-bold text-[#FF4D4D] bg-[#E50000]/20 px-1 py-0.2 rounded">PWA</span>
                  </div>
                  <div className="text-[10px] text-[#8E8E93]">Tối ưu cho iPhone, Android & PC</div>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[#8E8E93] group-hover:text-white transition-colors">
                Cài ngay ›
              </span>
            </button>
          </div>

        </div>

        {/* Bottom Bar */}
        <div
          suppressHydrationWarning
          className="pt-6 sm:pt-8 border-t border-[#1C1C1C] flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center text-xs text-[#71717A]"
        >
          <span>© 2026 <strong className="text-[#E5E7EB] font-semibold">RubyFilm</strong>.</span>
          <span className="hidden sm:inline">•</span>
          <span>Nền tảng giải trí phim ảnh trực tuyến miễn phí.</span>
        </div>
      </div>

      {/* Floating Quick Scroll-to-Top Button */}
      {showFloatingScroll && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 flex items-center justify-center w-11 h-11 rounded-full bg-[#141414]/90 hover:bg-[#E50000] border border-[#2E2E2E] hover:border-[#E50000] text-cinema-300 hover:text-white shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer group"
          title="Cuộn lên đầu trang"
          aria-label="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
    </footer>
  );
}
