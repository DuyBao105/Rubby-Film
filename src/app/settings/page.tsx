"use client";

import * as React from "react";
import Link from "next/link";
import {
  Settings as SettingsIcon,
  Tv,
  Sliders,
  Trash2,
  Check,
  ShieldCheck,
  User,
  LogIn,
  LogOut,
  RefreshCw,
  Clock,
  Heart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUserProfile } from "@/lib/hooks/use-user-profile";
import { useAuth } from "@/lib/hooks/use-auth";
import { useMyList } from "@/lib/hooks/use-my-list";
import { useWatchHistory } from "@/lib/hooks/use-watch-history";

export default function SettingsPage() {
  const { preferences, updatePreferences } = useUserProfile();
  const { user: authUser, isAuthenticated, logout, unlinkProvider } = useAuth();
  const { list, clearList } = useMyList();
  const { history, clearHistory } = useWatchHistory();

  const [savedNotice, setSavedNotice] = React.useState(false);
  const [migrationNotice, setMigrationNotice] = React.useState("");
  const [providerNotice, setProviderNotice] = React.useState<{ text: string; isError?: boolean } | null>(null);

  const showSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleUnlink = async (provider: "google" | "facebook") => {
    const res = await unlinkProvider(provider);
    if (res.success) {
      setProviderNotice({ text: `Đã hủy liên kết tài khoản ${provider === "google" ? "Google" : "Facebook"} thành công.` });
    } else {
      setProviderNotice({ text: res.error || "Không thể hủy liên kết tài khoản.", isError: true });
    }
    setTimeout(() => setProviderNotice(null), 3500);
  };

  const handleQualityChange = (val: "4k" | "1080p" | "auto") => {
    updatePreferences({ defaultQuality: val });
    showSaved();
  };

  const handleAutoNextToggle = () => {
    updatePreferences({ autoNext: !preferences.autoNext });
    showSaved();
  };

  const handleLanguageChange = (val: "vietsub" | "dub" | "orig") => {
    updatePreferences({ preferredLanguage: val });
    showSaved();
  };

  // Guest to Account Migration & Cloud Sync action
  const handleMigrateGuestData = async () => {
    if (!isAuthenticated) return;
    setMigrationNotice("Đang đồng bộ dữ liệu vào tài khoản máy chủ...");
    try {
      const historyItems = watchHistoryService.getHistory();
      const favoriteItems = myListService.getList();

      await Promise.all([
        fetch("/api/user/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: historyItems }),
        }),
        fetch("/api/user/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: favoriteItems }),
        }),
      ]);

      setMigrationNotice("Đã đồng bộ toàn bộ danh sách và lịch sử xem lên đám mây thành công!");
    } catch {
      setMigrationNotice("Đồng bộ gặp sự cố kết nối. Vui lòng thử lại!");
    } finally {
      setTimeout(() => setMigrationNotice(""), 4000);
    }
  };

  return (
    <div className="pt-20 sm:pt-24 pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 mb-8 border-b border-cinema-750">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center gap-3">
            <SettingsIcon className="w-7 h-7 text-brand" />
            <span>Cài Đặt & Tùy Chọn</span>
          </h1>
          <p className="text-sm text-cinema-400 mt-1">
            Quản lý trải nghiệm xem phim, chất lượng phát và đồng bộ dữ liệu
          </p>
        </div>

        {savedNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>Đã lưu cài đặt</span>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {/* Account / Session Section */}
        <div className="p-6 rounded-2xl bg-cinema-850/80 border border-cinema-700/60 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-brand" />
              <span>Tài Khoản & Phiên Đăng Nhập</span>
            </h2>
            <Badge variant="brand">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {isAuthenticated ? "Đã Đăng Nhập" : "Khách (Guest)"}
            </Badge>
          </div>

          {isAuthenticated && authUser ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-cinema-900 border border-cinema-750">
                <div>
                  <p className="font-bold text-white">{authUser.name}</p>
                  <p className="text-xs text-cinema-400">{authUser.email}</p>
                  <p className="text-[11px] text-cinema-500 mt-1">
                    Đã đăng nhập bảo mật với phiên HttpOnly
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={logout}
                    className="text-xs text-red-400 border-cinema-700 hover:bg-red-500/10 hover:border-red-500/40"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    <span>Đăng xuất</span>
                  </Button>
                </div>
              </div>

              {/* Connected Accounts Section */}
              <div className="pt-2 border-t border-cinema-750/70 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">Tài Khoản Liên Kết (Connected Accounts)</h3>
                    <p className="text-xs text-cinema-400 mt-0.5">
                      Quản lý các tài khoản mạng xã hội dùng để đăng nhập vào RubbyFilm
                    </p>
                  </div>
                </div>

                {providerNotice && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold animate-in fade-in flex items-center gap-2 ${
                      providerNotice.isError
                        ? "bg-red-500/15 border border-red-500/30 text-red-300"
                        : "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300"
                    }`}
                  >
                    <span>{providerNotice.text}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Google Connection Card */}
                  <div className="p-3.5 rounded-xl bg-cinema-900 border border-cinema-750 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white">Google</p>
                        <p className="text-[11px] text-cinema-400 truncate">
                          {authUser.providers?.includes("google") ? "Đã liên kết" : "Chưa liên kết"}
                        </p>
                      </div>
                    </div>

                    {authUser.providers?.includes("google") ? (
                      <button
                        type="button"
                        onClick={() => handleUnlink("google")}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors flex-shrink-0"
                      >
                        Hủy liên kết
                      </button>
                    ) : (
                      <Link
                        href="/api/auth/oauth/google?callbackUrl=/settings"
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-cinema-950 bg-brand hover:bg-amber-400 transition-colors flex-shrink-0"
                      >
                        Liên kết
                      </Link>
                    )}
                  </div>

                  {/* Facebook Connection Card */}
                  <div className="p-3.5 rounded-xl bg-cinema-900 border border-cinema-750 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4" fill="#1877F2" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-white">Facebook</p>
                        <p className="text-[11px] text-cinema-400 truncate">
                          {authUser.providers?.includes("facebook") ? "Đã liên kết" : "Chưa liên kết"}
                        </p>
                      </div>
                    </div>

                    {authUser.providers?.includes("facebook") ? (
                      <button
                        type="button"
                        onClick={() => handleUnlink("facebook")}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors flex-shrink-0"
                      >
                        Hủy liên kết
                      </button>
                    ) : (
                      <Link
                        href="/api/auth/oauth/facebook?callbackUrl=/settings"
                        className="px-2.5 py-1 rounded-lg text-xs font-bold text-cinema-950 bg-brand hover:bg-amber-400 transition-colors flex-shrink-0"
                      >
                        Liên kết
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-cinema-900 border border-cinema-750 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">Bạn đang sử dụng phiên Khách (Guest)</p>
                <p className="text-xs text-cinema-400 mt-0.5">
                  Lịch sử xem và danh sách yêu thích đang được lưu cục bộ trên thiết bị này.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="primary" size="sm" className="text-xs font-bold gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    <span>Đăng nhập</span>
                  </Button>
                </Link>
                <Link href="/register">
                  <Button variant="outline" size="sm" className="text-xs border-cinema-700">
                    <span>Đăng ký</span>
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Video Player Preferences */}
        <div className="p-6 rounded-2xl bg-cinema-850/80 border border-cinema-700/60 shadow-xl space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Tv className="w-5 h-5 text-brand" />
            <span>Trình Phát Video (Player)</span>
          </h2>

          {/* Auto Next Episode */}
          <div className="flex items-center justify-between pb-4 border-b border-cinema-750">
            <div>
              <p className="text-sm font-semibold text-white">Tự động phát tập tiếp theo</p>
              <p className="text-xs text-cinema-400 mt-0.5">
                Hiển thị đếm ngược 5 giây và tự động chuyển tập khi xem phim bộ
              </p>
            </div>
            <button
              type="button"
              onClick={handleAutoNextToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferences.autoNext ? "bg-brand" : "bg-cinema-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-cinema-950 font-bold transition-transform ${
                  preferences.autoNext ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Quality Priority */}
          <div className="space-y-2 pb-4 border-b border-cinema-750">
            <p className="text-sm font-semibold text-white">Chất lượng phát ưu tiên</p>
            <p className="text-xs text-cinema-400">
              Trình phát sẽ cố gắng chọn mức phân giải này trước nếu nguồn phát hỗ trợ
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { id: "auto", label: "Tự động (Khuyên dùng)" },
                { id: "1080p", label: "Full HD 1080p" },
                { id: "4k", label: "Ultra HD 4K" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleQualityChange(opt.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    preferences.defaultQuality === opt.id
                      ? "bg-brand text-cinema-950 border-brand font-bold shadow-md shadow-brand/20"
                      : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Language */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-white">Ngôn ngữ ưu tiên</p>
            <p className="text-xs text-cinema-400">
              Ưu tiên server hoặc luồng âm thanh theo lựa chọn của bạn
            </p>
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              {[
                { id: "vietsub", label: "Vietsub (Phụ đề)" },
                { id: "dub", label: "Thuyết minh / Lồng tiếng" },
                { id: "orig", label: "Nguyên bản" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleLanguageChange(opt.id as any)}
                  className={`p-3 rounded-xl border text-xs font-semibold transition-all ${
                    preferences.preferredLanguage === opt.id
                      ? "bg-brand text-cinema-950 border-brand font-bold shadow-md shadow-brand/20"
                      : "bg-cinema-800 text-cinema-300 border-cinema-700 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data & Migration Section */}
        <div className="p-6 rounded-2xl bg-cinema-850/80 border border-cinema-700/60 shadow-xl space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand" />
            <span>Quản Lý Dữ Liệu & Di Trú (Migration)</span>
          </h2>

          {isAuthenticated && (
            <div className="p-4 rounded-xl bg-brand/10 border border-brand/30 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-brand" />
                    <span>Đồng bộ dữ liệu khách vào tài khoản</span>
                  </p>
                  <p className="text-xs text-cinema-300 mt-0.5">
                    Hợp nhất danh sách phim và lịch sử xem đang lưu trên trình duyệt vào tài khoản của bạn.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleMigrateGuestData}
                  className="font-bold text-xs"
                >
                  Đồng bộ ngay
                </Button>
              </div>
              {migrationNotice && (
                <p className="text-xs font-semibold text-brand animate-fade-in">{migrationNotice}</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-cinema-400" />
                <span>Danh sách yêu thích ({list.length} phim)</span>
              </p>
              <p className="text-xs text-cinema-400">Xóa toàn bộ các phim đã lưu vào danh sách xem sau</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={list.length === 0}
              onClick={() => {
                if (confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách yêu thích?")) {
                  clearList();
                  showSaved();
                }
              }}
              className="text-xs border-cinema-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Xóa danh sách</span>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-cinema-750">
            <div>
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cinema-400" />
                <span>Lịch sử xem phim ({history.length} mục)</span>
              </p>
              <p className="text-xs text-cinema-400">Xóa toàn bộ các mốc thời gian và phim đã xem</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={history.length === 0}
              onClick={() => {
                if (confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử xem phim?")) {
                  clearHistory();
                  showSaved();
                }
              }}
              className="text-xs border-cinema-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>Xóa lịch sử</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
