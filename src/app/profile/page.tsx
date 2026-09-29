"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  User as UserIcon,
  ShieldCheck,
  Heart,
  History,
  Check,
  Play,
  Clock,
  Trash2,
  Edit2,
  X,
  LogOut,
  LogIn,
  Sparkles,
  ChevronRight,
  Camera,
  Upload,
  RefreshCw,
} from "lucide-react";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";
import { useUserProfile } from "@/lib/hooks/use-user-profile";
import { useAuth } from "@/lib/hooks/use-auth";
import { MovieGrid } from "@/components/movie/movie-grid";
import { FALLBACK_POSTER } from "@/lib/utils/image";
import { cn } from "@/lib/utils";

// Curated high-resolution cinema avatar presets
const PRESET_AVATARS = [
  { id: "cinema-1", label: "Điện Ảnh Noir", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-2", label: "Đặc Vụ Ngầm", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-3", label: "Phi Hành Gia", url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-4", label: "Đạo Diễn Trẻ", url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-5", label: "Chiến Binh Màn Bạc", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-6", label: "Minh Tinh Điện Ảnh", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-7", label: "Cyber Punk", url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=256&h=256&fit=crop&crop=faces&q=80" },
  { id: "cinema-8", label: "Anime Cine", url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=256&h=256&fit=crop&crop=faces&q=80" },
];

function resizeImageToDataUrl(file: File, maxSize = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function ProfileContent() {
  const searchParams = useSearchParams();
  const { list, clearList } = useMyList();
  const { history, clearHistory, removeFromHistory } = useWatchHistory();
  const { user, updateUser } = useUserProfile();
  const { user: authUser, isAuthenticated, logout, updateProfile } = useAuth();

  const [activeTab, setActiveTab] = React.useState<"overview" | "mylist" | "history">("overview");
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const displayName = authUser?.name || user.name || "Khán Giả RubyFilm";
  const displayEmail = authUser?.email || user.email || "Tài khoản khách (Lưu trên trình duyệt này)";
  const currentAvatar = authUser?.avatarUrl || user.avatarUrl || "";

  // Dedicated reactive states for immediate UI updates
  const [profileName, setProfileName] = React.useState<string>(displayName);
  const [profileAvatar, setProfileAvatar] = React.useState<string>(currentAvatar);
  const [nameInput, setNameInput] = React.useState(displayName);

  // Sync state when authUser or user changes
  React.useEffect(() => {
    if (authUser?.name) {
      setProfileName(authUser.name);
    } else if (user.name) {
      setProfileName(user.name);
    }
  }, [authUser?.name, user.name]);

  React.useEffect(() => {
    if (authUser?.avatarUrl !== undefined && authUser.avatarUrl !== "") {
      setProfileAvatar(authUser.avatarUrl);
    } else if (user.avatarUrl) {
      setProfileAvatar(user.avatarUrl);
    }
  }, [authUser?.avatarUrl, user.avatarUrl]);

  // Synchronize activeTab from query param ?tab=
  React.useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "mylist" || tabParam === "history" || tabParam === "overview") {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  React.useEffect(() => {
    setNameInput(profileName);
  }, [profileName]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) return;

    // 1. Immediately update UI state
    setProfileName(clean);
    setIsEditingName(false);

    // 2. Sync to auth context (updates local state + cached user + server PATCH)
    await updateProfile({ name: clean });

    // 3. Sync to user preference service (localStorage)
    updateUser({ name: clean });

    showToast("Đã cập nhật tên hiển thị thành công!");
  };

  const handleSelectAvatar = async (url: string) => {
    // 1. Immediately update UI state
    setProfileAvatar(url);
    setIsAvatarModalOpen(false);

    // 2. Sync to auth context (updates local state + cached user + server PATCH)
    await updateProfile({ avatarUrl: url });

    // 3. Sync to user preference service (localStorage)
    updateUser({ avatarUrl: url });

    showToast(url ? "Đã cập nhật ảnh đại diện thành công!" : "Đã đặt lại avatar mặc định!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 256);
      await handleSelectAvatar(dataUrl);
    } catch (err) {
      console.error("Lỗi khi tải ảnh đại diện:", err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}p`;
    return `${mins} phút`;
  };

  // Calculate total watch time across all episodes and movies in real-time
  const totalWatchHours = React.useMemo(() => {
    let totalSeconds = 0;
    for (const h of history) {
      if (h.watchedEpisodes && Object.keys(h.watchedEpisodes).length > 0) {
        for (const ep of Object.values(h.watchedEpisodes)) {
          totalSeconds += (ep.progressSeconds || 0);
        }
      } else {
        totalSeconds += (h.progressSeconds || 0);
      }
    }
    if (totalSeconds <= 0) return "0p";
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}p`;
    const hours = (totalSeconds / 3600).toFixed(1);
    return `${hours}h`;
  }, [history]);

  if (!mounted) {
    return (
      <div className="min-h-screen pt-20 sm:pt-24 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full select-none">
        <div className="relative overflow-hidden rounded-3xl bg-[#141414] border border-white/10 p-8 flex flex-col md:flex-row items-center gap-6 animate-pulse mb-8">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/10 shrink-0" />
          <div className="space-y-3 flex-1 w-full text-center md:text-left">
            <div className="h-8 w-48 bg-white/10 rounded-xl mx-auto md:mx-0" />
            <div className="h-4 w-64 bg-white/5 rounded-lg mx-auto md:mx-0" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 pb-24 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full select-none">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#141414] border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-semibold shadow-[0_10px_30px_rgba(16,185,129,0.3)] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Cinematic Profile Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#181818] to-[#101010] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] mb-8">
        {/* Ambient Top Glow Overlay */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-44 bg-gradient-to-b from-[#E50000]/15 via-[#E50000]/5 to-transparent blur-2xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-gradient-to-br from-[#E50000]/15 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 p-6 sm:p-8 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8">
          {/* Avatar with Interactive Edit Overlay - Clean cinema styling (VIP frame removed) */}
          <div className="relative group shrink-0">
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="relative block rounded-full focus:outline-none focus:ring-2 focus:ring-[#E50000] focus:ring-offset-2 focus:ring-offset-black cursor-pointer group"
              title="Nhấn để đổi ảnh đại diện"
              aria-label="Đổi ảnh đại diện"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-[2.5px] bg-gradient-to-tr from-[#E50000] via-red-500 to-[#E50000]/40 shadow-[0_0_20px_rgba(229,0,0,0.35)] transition-transform duration-300 group-hover:scale-105">
                <div
                  suppressHydrationWarning
                  className="w-full h-full rounded-full bg-[#121212] flex items-center justify-center text-white overflow-hidden relative"
                >
                  {mounted && profileAvatar ? (
                    <img
                      src={profileAvatar}
                      alt={profileName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#1F1F1F] to-[#121212] flex items-center justify-center">
                      <UserIcon className="w-12 h-12 text-white/70" />
                    </div>
                  )}

                  {/* Hover Camera Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white backdrop-blur-[2px]">
                    <Camera className="w-5 h-5 text-white drop-shadow" />
                    <span className="text-[10px] font-bold tracking-wide">Đổi ảnh</span>
                  </div>
                </div>
              </div>

              {/* Floating Camera Button badge */}
              <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#E50000] hover:bg-[#FF1A1A] border-2 border-[#121212] flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* User Details & Identity */}
          <div className="flex-1 text-center md:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center md:justify-start mb-2">
              {isEditingName ? (
                <form onSubmit={handleSaveName} className="flex items-center gap-2 max-w-sm">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="bg-[#1C1C1C] border border-[#E50000] text-white text-base font-bold px-3 py-1.5 rounded-xl outline-none w-full"
                    autoFocus
                    placeholder="Nhập tên hiển thị..."
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-xl bg-[#E50000] hover:bg-[#FF1A1A] text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(profileName);
                      setIsEditingName(false);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#D1D5DB] text-xs font-medium transition-colors cursor-pointer shrink-0"
                  >
                    Hủy
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-2.5 justify-center md:justify-start">
                  <h1
                    suppressHydrationWarning
                    className="text-2xl sm:text-3xl font-extrabold text-[#F9FAFB] tracking-tight font-heading truncate"
                  >
                    {profileName}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setNameInput(profileName);
                      setIsEditingName(true);
                    }}
                    className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.14] text-[#9CA3AF] hover:text-white transition-colors cursor-pointer"
                    title="Đổi tên hiển thị"
                    aria-label="Đổi tên hiển thị"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <span
                suppressHydrationWarning
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-bold self-center md:self-auto w-fit"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{authUser ? "Tài Khoản Đã Đồng Bộ" : "Chế Độ Khách"}</span>
              </span>
            </div>

            <p suppressHydrationWarning className="text-xs sm:text-sm text-[#9CA3AF] mb-3 truncate">
              {displayEmail}
            </p>

            {/* Connected Providers */}
            {isAuthenticated && authUser && (
              <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap mb-4">
                <span className="text-[11px] text-[#9CA3AF]">Liên kết đăng nhập:</span>
                {authUser.providers?.includes("credentials") && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-semibold text-white">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Email & Mật khẩu</span>
                  </span>
                )}
                {authUser.providers?.includes("google") && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-semibold text-white">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>Google</span>
                  </span>
                )}
                {authUser.providers?.includes("facebook") && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.06] border border-white/10 text-[11px] font-semibold text-white">
                    <svg className="w-3 h-3" fill="#1877F2" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    <span>Facebook</span>
                  </span>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-3 justify-center md:justify-start">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#E50000]" />
                <span>Đổi ảnh đại diện</span>
              </button>

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-red-500/15 border border-white/10 hover:border-red-500/40 text-xs font-semibold text-[#D1D5DB] hover:text-red-400 transition-all cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất tài khoản</span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#E50000] to-[#B30000] text-white text-xs sm:text-sm font-bold shadow-[0_4px_16px_rgba(229,0,0,0.4)] hover:shadow-[0_6px_20px_rgba(229,0,0,0.6)] transition-all cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Đăng nhập để đồng bộ</span>
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                  >
                    <span>Tạo tài khoản</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Banner Row */}
        <div className="grid grid-cols-3 border-t border-white/10 bg-black/40 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setActiveTab("mylist")}
            className="p-4 sm:p-5 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.04] transition-colors border-r border-white/10 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] group-hover:text-rose-400 transition-colors">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Phim</span> Yêu Thích
            </div>
            <span className="text-xl sm:text-2xl font-black text-white font-heading group-hover:scale-105 transition-transform">
              {list.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className="p-4 sm:p-5 flex flex-col items-center justify-center gap-1 hover:bg-white/[0.04] transition-colors border-r border-white/10 cursor-pointer group"
          >
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF] group-hover:text-blue-400 transition-colors">
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Lịch Sử</span> Đã Xem
            </div>
            <span className="text-xl sm:text-2xl font-black text-white font-heading group-hover:scale-105 transition-transform">
              {history.length}
            </span>
          </button>

          <div className="p-4 sm:p-5 flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Thời Lượng Đã Cày</span>
            </div>
            <span suppressHydrationWarning className="text-xl sm:text-2xl font-black text-amber-400 font-heading">
              {totalWatchHours}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Modern Segmented Capsule Tabs Navigation */}
      <div className="flex items-center justify-center sm:justify-start mb-8 overflow-x-auto no-scrollbar">
        <div className="inline-flex items-center gap-1 p-1.5 rounded-2xl bg-[#141414] border border-white/10 backdrop-blur-xl shadow-lg">
          {[
            { id: "overview", label: "Tổng Quan & Đang Xem Dở", icon: Sparkles },
            { id: "mylist", label: `Phim Yêu Thích (${list.length})`, icon: Heart },
            { id: "history", label: `Lịch Sử Xem (${history.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap cursor-pointer",
                  isActive
                    ? "bg-gradient-to-r from-[#E50000] to-[#B30000] text-white shadow-[0_4px_16px_rgba(229,0,0,0.4)] font-bold scale-[1.02]"
                    : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.06]"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-[#9CA3AF]")} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB CONTENT */}

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-10">
          {/* Section: Continue Watching */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-6 rounded-full bg-[#E50000] inline-block shadow-[0_0_8px_rgba(229,0,0,0.8)]" />
                <h2 className="text-xl font-bold text-white font-heading">
                  Phim Đang Xem Dở
                </h2>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("history")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50000] hover:text-[#FF1A1A] transition-colors cursor-pointer"
                >
                  <span>Xem tất cả</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {history.filter((h) => h.progressSeconds > 15 && !h.completed).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {history
                  .filter((h) => h.progressSeconds > 15 && !h.completed)
                  .slice(0, 6)
                  .map((item, idx) => {
                    const targetUrl =
                      item.movie.type === "series" && item.episodeNumber
                        ? `/watch/${item.slug}?episode=${item.episodeNumber}`
                        : `/watch/${item.slug}`;

                    return (
                      <div
                        key={`${item.movieId}-${item.episodeNumber || 1}-${idx}`}
                        className="group relative flex rounded-2xl bg-[#141414] border border-white/10 overflow-hidden hover:border-[#E50000]/50 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                      >
                        {/* Poster Thumbnail */}
                        <Link
                          href={targetUrl}
                          className="relative w-28 sm:w-32 aspect-poster flex-shrink-0 bg-[#1C1C1C] overflow-hidden"
                        >
                          <Image
                            src={item.posterUrl || item.movie?.posterUrl || FALLBACK_POSTER}
                            alt={item.title || item.movie?.title || "Poster phim"}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            sizes="128px"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="w-9 h-9 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 fill-white translate-x-0.5" />
                            </div>
                          </div>
                          {/* Progress bar line */}
                          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/80">
                            <div
                              className="h-full bg-gradient-to-r from-[#E50000] to-[#FF4D4D] shadow-[0_0_8px_rgba(229,0,0,0.9)]"
                              style={{ width: `${item.progressPercent}%` }}
                            />
                          </div>
                        </Link>

                        {/* Content */}
                        <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 min-w-0">
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1.5">
                              <span className="text-[10px] font-bold text-[#E50000] bg-[#E50000]/10 px-2 py-0.5 rounded-full border border-[#E50000]/25">
                                {item.progressPercent}% Đã xem
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const targetId = item.movieId || item.movie?.id || item.slug || item.movie?.slug;
                                  if (targetId) removeFromHistory(targetId);
                                }}
                                title="Xóa khỏi danh sách"
                                aria-label="Xóa khỏi danh sách"
                                className="text-[#9CA3AF] hover:text-red-400 p-1 transition-colors cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <Link href={targetUrl} className="block">
                              <h3 className="text-sm font-bold text-[#F9FAFB] group-hover:text-[#E50000] transition-colors truncate font-heading">
                                {item.title}
                              </h3>
                            </Link>
                            <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                              {item.episodeName || (item.episodeNumber ? `Tập ${item.episodeNumber}` : "Bản Full")}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs mt-3">
                            <span className="text-[#9CA3AF] flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3 text-[#E50000]" />
                              <span>{formatSeconds(item.progressSeconds)}</span>
                            </span>
                            <Link
                              href={targetUrl}
                              className="font-bold text-[#E50000] hover:text-[#FF1A1A] inline-flex items-center gap-0.5 transition-colors"
                            >
                              <span>Tiếp tục</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-8 sm:p-12 rounded-2xl bg-[#141414] border border-white/10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-3 text-[#9CA3AF]">
                  <Play className="w-5 h-5 ml-0.5" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Chưa có phim nào đang xem dở</p>
                <p className="text-xs text-[#9CA3AF] max-w-sm mb-4">
                  Khi bạn xem phim trên RubyFilm, thanh tiến trình xem sẽ tự động lưu lại ở đây để bạn có thể xem tiếp bất cứ lúc nào.
                </p>
                <Link
                  href="/movies"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                >
                  Khám phá phim ngay
                </Link>
              </div>
            )}
          </div>

          {/* Section: Favorite Movies Preview */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-6 rounded-full bg-[#E50000] inline-block shadow-[0_0_8px_rgba(229,0,0,0.8)]" />
                <h2 className="text-xl font-bold text-white font-heading">
                  Phim Đã Lưu Trong Danh Sách ({list.length})
                </h2>
              </div>
              {list.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("mylist")}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E50000] hover:text-[#FF1A1A] transition-colors cursor-pointer"
                >
                  <span>Xem tất cả ({list.length})</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {list.length > 0 ? (
              <MovieGrid movies={list.slice(0, 6)} />
            ) : (
              <div className="p-8 sm:p-12 rounded-2xl bg-[#141414] border border-white/10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-3 text-[#9CA3AF]">
                  <Heart className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Danh sách yêu thích đang trống</p>
                <p className="text-xs text-[#9CA3AF] max-w-sm mb-4">
                  Bấm vào nút &ldquo;Yêu thích&rdquo; trên bất kỳ poster phim nào để lưu lại danh sách riêng của bạn.
                </p>
                <Link
                  href="/trending"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                >
                  Xem phim thịnh hành
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY LIST */}
      {activeTab === "mylist" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white font-heading">
                Bộ Sưu Tập Phim Yêu Thích
              </h2>
              <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
                Tổng cộng {list.length} bộ phim đã được lưu vào danh sách của bạn
              </p>
            </div>
            {list.length > 0 && (
              <button
                type="button"
                onClick={clearList}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-semibold transition-colors cursor-pointer w-fit self-end sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ danh sách</span>
              </button>
            )}
          </div>

          {list.length > 0 ? (
            <MovieGrid movies={list} />
          ) : (
            <div className="p-16 rounded-3xl bg-[#141414] border border-white/10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4 text-[#9CA3AF]">
                <Heart className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1 font-heading">Danh sách trống</h3>
              <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-md mb-5">
                Bạn chưa lưu bộ phim nào. Hãy khám phá kho phim khổng lồ và đánh dấu các bộ phim tâm đắc nhé!
              </p>
              <Link
                href="/trending"
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#E50000] to-[#B30000] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-[0_4px_16px_rgba(229,0,0,0.5)] transition-all cursor-pointer"
              >
                Khám Phá Phim Hot
              </Link>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: WATCH HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white font-heading">
                Lịch Sử Phim Đã Xem
              </h2>
              <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
                Lưu lại toàn bộ các bộ phim và tập phim bạn đã thưởng thức ({history.length} mục)
              </p>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 text-xs font-semibold transition-colors cursor-pointer w-fit self-end sm:self-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa toàn bộ lịch sử</span>
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((item, idx) => {
                const targetUrl =
                  item.movie.type === "series" && item.episodeNumber
                    ? `/watch/${item.slug}?episode=${item.episodeNumber}`
                    : `/watch/${item.slug}`;

                return (
                  <div
                    key={`${item.movieId}-${item.episodeNumber || 1}-${idx}`}
                    className="group relative flex rounded-2xl bg-[#141414] border border-white/10 overflow-hidden hover:border-[#E50000]/50 transition-all duration-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
                  >
                    <Link
                      href={targetUrl}
                      className="relative w-28 sm:w-32 aspect-poster flex-shrink-0 bg-[#1C1C1C] overflow-hidden"
                    >
                      <Image
                        src={item.posterUrl || item.movie?.posterUrl || FALLBACK_POSTER}
                        alt={item.title || item.movie?.title || "Poster phim"}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="128px"
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="w-9 h-9 rounded-full bg-[#E50000] text-white flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-white translate-x-0.5" />
                        </div>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/80">
                        <div
                          className="h-full bg-gradient-to-r from-[#E50000] to-[#FF4D4D] shadow-[0_0_8px_rgba(229,0,0,0.9)]"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    </Link>

                    <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-bold text-[#E50000] bg-[#E50000]/10 px-2 py-0.5 rounded-full border border-[#E50000]/25">
                            {item.progressPercent}% Đã xem
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFromHistory(item.movieId)}
                            className="text-[#9CA3AF] hover:text-red-400 p-1 transition-colors cursor-pointer"
                            title="Xóa khỏi lịch sử"
                            aria-label="Xóa khỏi lịch sử"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <Link href={targetUrl} className="block">
                          <h3 className="text-sm font-bold text-[#F9FAFB] group-hover:text-[#E50000] transition-colors truncate font-heading">
                            {item.title}
                          </h3>
                        </Link>
                        <p className="text-xs text-[#9CA3AF] mt-0.5 truncate">
                          {item.episodeName || (item.episodeNumber ? `Tập ${item.episodeNumber}` : "Bản Full")}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs mt-3">
                        <span className="text-[#9CA3AF] flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-[#E50000]" />
                          <span>{formatSeconds(item.progressSeconds)}</span>
                        </span>
                        <Link
                          href={targetUrl}
                          className="font-bold text-[#E50000] hover:text-[#FF1A1A] inline-flex items-center gap-0.5 transition-colors"
                        >
                          <span>Xem lại</span>
                          <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-16 rounded-3xl bg-[#141414] border border-white/10 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-3xl bg-white/[0.05] border border-white/10 flex items-center justify-center mb-4 text-[#9CA3AF]">
                <History className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1 font-heading">Lịch sử xem phim trống</h3>
              <p className="text-xs sm:text-sm text-[#9CA3AF] max-w-md mb-5">
                Các phim và tập phim bạn thưởng thức sẽ tự động xuất hiện tại đây để bạn tiện theo dõi.
              </p>
              <Link
                href="/movies"
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#E50000] to-[#B30000] text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-[0_4px_16px_rgba(229,0,0,0.5)] transition-all cursor-pointer"
              >
                Xem Phim Ngay
              </Link>
            </div>
          )}
        </div>
      )}

      {/* 4. MODAL: ĐỔI ẢNH ĐẠI DIỆN */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-[#141414] border border-white/15 p-6 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.9)] max-h-[90vh] overflow-y-auto no-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white font-heading">
                  Thay Đổi Ảnh Đại Diện
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">
                  Tải ảnh từ thiết bị hoặc chọn nhân vật điện ảnh yêu thích
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option 1: Upload from Device */}
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block mb-2">
                1. Tải ảnh từ thiết bị của bạn
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="avatar-file-upload"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-white/[0.08] to-white/[0.04] hover:from-[#E50000]/20 hover:to-transparent border border-white/10 hover:border-[#E50000]/50 text-white font-semibold text-xs sm:text-sm transition-all cursor-pointer group"
              >
                <Upload className="w-4 h-4 text-[#E50000] group-hover:scale-110 transition-transform" />
                <span>Chọn ảnh từ máy tính hoặc điện thoại</span>
              </button>
              <p className="text-[11px] text-[#9CA3AF]/80 mt-1.5 text-center">
                Hỗ trợ JPG, PNG, WEBP. Ảnh sẽ tự động tối ưu hóa kích thước.
              </p>
            </div>

            {/* Option 2: Curated Cinema Avatars */}
            <div className="mb-6">
              <label className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] block mb-3">
                2. Hoặc chọn nhân vật điện ảnh RubyFilm
              </label>
              <div className="grid grid-cols-4 gap-3 sm:gap-4">
                {PRESET_AVATARS.map((preset) => {
                  const isSelected = profileAvatar === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectAvatar(preset.url)}
                      className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
                    >
                      <div
                        className={cn(
                          "relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden p-0.5 border-2 transition-all duration-200",
                          isSelected
                            ? "border-[#E50000] ring-2 ring-[#E50000]/50 scale-105"
                            : "border-transparent hover:border-white/40 group-hover:scale-105"
                        )}
                      >
                        <img
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full object-cover rounded-full"
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                            <Check className="w-5 h-5 text-[#E50000] stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] sm:text-[11px] font-medium truncate max-w-[70px] text-center",
                          isSelected ? "text-[#E50000] font-bold" : "text-[#9CA3AF] group-hover:text-white"
                        )}
                      >
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option 3: Reset Avatar */}
            {profileAvatar && (
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleSelectAvatar("")}
                  className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-red-400 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Xóa ảnh & Dùng avatar mặc định</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen pt-32 pb-24 max-w-6xl mx-auto px-4 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-[#E50000] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-[#9CA3AF]">Đang tải trang cá nhân...</p>
        </div>
      }
    >
      <ProfileContent />
    </React.Suspense>
  );
}
