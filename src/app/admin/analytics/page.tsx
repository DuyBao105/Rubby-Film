"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Eye,
  Smartphone,
  Monitor,
  Activity,
  ArrowLeft,
  RefreshCw,
  Shield,
  Clock,
  Compass,
  Sparkles,
  Layers,
  CheckCircle2,
  X,
  Search,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import type {
  RealtimeAnalyticsStats,
  TodayVisitor,
  TodayPageViewLog,
} from "@/lib/server/presenceTracker";

type ModalType = "pageviews" | "visitors" | "devices" | null;

export default function AdminAnalyticsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<RealtimeAnalyticsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Active detail modal state
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deviceTab, setDeviceTab] = useState<"mobile" | "desktop">("mobile");

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/analytics/realtime");
      if (res.ok) {
        const json = await res.json();
        if (json.ok && json.data) {
          setStats(json.data);
          setLastRefreshed(new Date());
        }
      }
    } catch (e) {
      console.error("Failed to fetch analytics:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      fetchStats();

      let es: EventSource | null = null;
      let isCancelled = false;

      const connectStream = () => {
        try {
          es = new EventSource("/api/admin/analytics/stream");
          es.addEventListener("presence", (event) => {
            try {
              const data: RealtimeAnalyticsStats = JSON.parse(event.data);
              if (!isCancelled && data) {
                setStats(data);
                setLastRefreshed(new Date());
                setIsLoading(false);
              }
            } catch {}
          });

          es.addEventListener("error", () => {
            if (es) {
              es.close();
              es = null;
            }
            if (!isCancelled) {
              setTimeout(connectStream, 3000);
            }
          });
        } catch {}
      };

      connectStream();

      return () => {
        isCancelled = true;
        if (es) es.close();
      };
    }
  }, [authLoading, user, fetchStats]);

  // Periodic fallback refresh every 10s if autoRefresh is on
  useEffect(() => {
    if (!autoRefresh || user?.role !== "admin") return;
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, user, fetchStats]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveModal(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filtered pageviews logs
  const filteredPageViews = useMemo(() => {
    const logs = stats?.todayPageViewsLogs || [];
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (l) =>
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        l.page.toLowerCase().includes(q) ||
        (l.title && l.title.toLowerCase().includes(q)) ||
        l.sessionId.toLowerCase().includes(q)
    );
  }, [stats?.todayPageViewsLogs, searchQuery]);

  // Filtered visitors
  const filteredVisitors = useMemo(() => {
    const visitors = stats?.todayVisitors || [];
    if (!searchQuery.trim()) return visitors;
    const q = searchQuery.toLowerCase();
    return visitors.filter(
      (v) =>
        (v.userName && v.userName.toLowerCase().includes(q)) ||
        v.lastPage.toLowerCase().includes(q) ||
        (v.lastTitle && v.lastTitle.toLowerCase().includes(q)) ||
        v.sessionId.toLowerCase().includes(q)
    );
  }, [stats?.todayVisitors, searchQuery]);

  // Device visitors split
  const mobileVisitors = useMemo(() => {
    return (stats?.todayVisitors || []).filter((v) => v.device === "mobile");
  }, [stats?.todayVisitors]);

  const desktopVisitors = useMemo(() => {
    return (stats?.todayVisitors || []).filter((v) => v.device === "desktop");
  }, [stats?.todayVisitors]);

  if (authLoading || (isLoading && !stats)) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#9CA3AF]">Đang tải dữ liệu Traffic thời gian thực...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white px-4">
        <div className="max-w-md w-full bg-[#141414] border border-[#262626] rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mx-auto mb-4">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Quyền Truy Cập Bị Giới Hạn</h2>
          <p className="text-xs text-[#9CA3AF] mb-6">
            Trang Dashboard Thống Kê Realtime chỉ dành cho tài khoản Quản Trị Viên (Admin).
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Về Trang Chủ
          </Link>
        </div>
      </div>
    );
  }

  const activeTotal = stats?.totalActive ?? 0;
  const mobileCount = stats?.devices.mobile ?? 0;
  const desktopCount = stats?.devices.desktop ?? 0;
  const mobilePercent = activeTotal > 0 ? Math.round((mobileCount / activeTotal) * 100) : 0;
  const desktopPercent = activeTotal > 0 ? 100 - mobilePercent : 0;

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F9FAFB] pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Top Bar Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#222222] mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/"
              className="text-xs text-[#9CA3AF] hover:text-white flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trang chủ</span>
            </Link>
            <span className="text-[#4B5563]">/</span>
            <span className="text-xs text-emerald-400 font-semibold">Admin Analytics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2.5">
            <span>Bảng Điều Khiển Lưu Lượng Trực Tiếp</span>
            <span className="text-xs font-bold bg-red-600/90 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
              Admin Only
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
            Bấm vào bất kỳ thẻ thống kê nào để xem chi tiết danh tính người dùng, thiết bị và các trang đã xem.
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
              autoRefresh
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                : "bg-[#181818] border-[#2A2A2A] text-[#9CA3AF]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-[#6B7280]"
              }`}
            />
            {autoRefresh ? "Stream trực tiếp" : "Tạm dừng"}
          </button>

          <button
            onClick={fetchStats}
            title="Làm mới ngay"
            className="p-2 rounded-xl bg-[#1A1A1A] hover:bg-[#252525] border border-[#2E2E2E] text-[#D1D5DB] hover:text-white transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <Link
            href="/admin/moderation"
            className="px-3.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-400 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Kiểm duyệt</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid - All Interactive and Clickable */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Active Users Right Now */}
        <div className="bg-[#141414] border border-[#262626] hover:border-emerald-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all group">
          <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Đang Online Trực Tiếp</span>
            <div className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </div>
          </div>
          <div className="text-4xl font-black text-emerald-400 font-mono tracking-tight">
            {activeTotal}
          </div>
          <div className="text-xs text-[#9CA3AF] mt-2 flex items-center gap-2">
            <span className="text-white font-semibold">{stats?.members ?? 0}</span> thành viên •{" "}
            <span className="text-white font-semibold">{stats?.guests ?? 0}</span> khách
          </div>
        </div>

        {/* Card 2: Today Pageviews - Clickable */}
        <div
          onClick={() => {
            setSearchQuery("");
            setActiveModal("pageviews");
          }}
          className="bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-[#FECF59]/60 rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-200 group relative select-none hover:shadow-[0_8px_30px_rgba(254,207,89,0.15)]"
        >
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Lượt Xem Hôm Nay</span>
            <Eye className="w-4 h-4 text-[#FECF59] group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-[#FECF59] font-mono tracking-tight">
            {stats?.todayStats.pageViews ?? 0}
          </div>
          <div className="flex items-center justify-between text-xs text-[#9CA3AF] mt-2">
            <span>Tổng lượt xem & chuyển trang</span>
            <span className="text-[11px] text-[#FECF59] font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              Xem ai xem →
            </span>
          </div>
        </div>

        {/* Card 3: Today Unique Visitors - Clickable */}
        <div
          onClick={() => {
            setSearchQuery("");
            setActiveModal("visitors");
          }}
          className="bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-blue-500/60 rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-200 group relative select-none hover:shadow-[0_8px_30px_rgba(59,130,246,0.15)]"
        >
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Khách Truy Cập Hôm Nay</span>
            <Users className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-4xl font-black text-blue-400 font-mono tracking-tight">
            {stats?.todayStats.uniqueVisitors ?? 0}
          </div>
          <div className="flex items-center justify-between text-xs text-[#9CA3AF] mt-2">
            <span>Số phiên duy nhất</span>
            <span className="text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition-transform flex items-center">
              Xem là ai →
            </span>
          </div>
        </div>

        {/* Card 4: Device Split - Clickable */}
        <div
          onClick={() => {
            setSearchQuery("");
            setActiveModal("devices");
          }}
          className="bg-[#141414] hover:bg-[#181818] border border-[#262626] hover:border-purple-500/60 rounded-2xl p-5 shadow-lg cursor-pointer transition-all duration-200 group relative select-none hover:shadow-[0_8px_30px_rgba(168,85,247,0.15)]"
        >
          <div className="flex items-center justify-between text-[#9CA3AF] text-xs mb-2">
            <span>Tỉ Lệ Thiết Bị</span>
            <Monitor className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
          </div>
          <div className="flex items-center gap-3 text-xl font-black text-white font-mono mt-1">
            <span className="text-blue-400 flex items-center gap-1">
              <Smartphone className="w-4 h-4" />
              {mobilePercent}%
            </span>
            <span className="text-[#4B5563]">/</span>
            <span className="text-purple-400 flex items-center gap-1">
              <Monitor className="w-4 h-4" />
              {desktopPercent}%
            </span>
          </div>
          <div className="w-full bg-[#262626] h-1.5 rounded-full overflow-hidden mt-3 flex">
            <div style={{ width: `${mobilePercent}%` }} className="bg-blue-500 h-full" />
            <div style={{ width: `${desktopPercent}%` }} className="bg-purple-500 h-full" />
          </div>
          <div className="text-right text-[11px] text-purple-400 font-semibold mt-1.5 group-hover:translate-x-0.5 transition-transform">
            Xem danh sách thiết bị →
          </div>
        </div>
      </div>

      {/* Main Content Grid: Top Pages & Recent Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (1 col): Top Pages Being Viewed Right Now */}
        <div className="lg:col-span-1 bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-[#222222] mb-4">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Trang Đang Được Xem</h3>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
              {stats?.topPages.length ?? 0} trang
            </span>
          </div>

          <div className="space-y-2">
            {stats?.topPages && stats.topPages.length > 0 ? (
              stats.topPages.map((p, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-[#1C1C1C] border border-[#282828] hover:border-[#383838] transition-all flex items-center justify-between"
                >
                  <div className="truncate max-w-[200px]">
                    <div className="text-xs font-semibold text-white truncate">
                      {p.title || p.page}
                    </div>
                    <div className="text-[10px] text-[#9CA3AF] font-mono truncate">
                      {p.page}
                    </div>
                  </div>
                  <div className="text-right ml-2 flex-shrink-0">
                    <span className="font-mono font-bold text-sm text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg">
                      {p.count} online
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[#6B7280] text-xs">
                Chưa có dữ liệu trang hoạt động
              </div>
            )}
          </div>
        </div>

        {/* Right Column (2 cols): Active Live Sessions Table */}
        <div className="lg:col-span-2 bg-[#141414] border border-[#262626] rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-[#222222] mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Phiên Hoạt Động Trực Tiếp</h3>
            </div>
            <span className="text-[11px] text-[#9CA3AF]">
              Cập nhật lúc: {lastRefreshed.toLocaleTimeString("vi-VN")}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] text-[#9CA3AF]">
                  <th className="pb-3 font-semibold">Phiên / Người dùng</th>
                  <th className="pb-3 font-semibold">Thiết bị</th>
                  <th className="pb-3 font-semibold">Trang hiện tại</th>
                  <th className="pb-3 font-semibold text-right">Thời gian lướt</th>
                  <th className="pb-3 font-semibold text-right">Ping gần nhất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222222]">
                {stats?.recentSessions && stats.recentSessions.length > 0 ? (
                  stats.recentSessions.map((s, idx) => (
                    <tr key={idx} className="hover:bg-[#1A1A1A] transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              {s.userName || "Khách Vãng Lai"}
                              {s.userRole === "admin" && (
                                <span className="text-[9px] bg-red-600 text-white px-1 py-0.2 rounded font-bold">
                                  ADMIN
                                </span>
                              )}
                              {s.userRole === "vip" && (
                                <span className="text-[9px] bg-[#FECF59] text-black px-1 py-0.2 rounded font-bold">
                                  VIP
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#6B7280] font-mono">
                              ID: {s.sessionId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-[#D1D5DB] font-mono">
                          {s.device === "mobile" ? (
                            <>
                              <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                              Mobile
                            </>
                          ) : (
                            <>
                              <Monitor className="w-3.5 h-3.5 text-purple-400" />
                              Desktop
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className="font-mono text-[#D1D5DB] truncate block max-w-[200px]"
                          title={s.page}
                        >
                          {s.title || s.page}
                        </span>
                      </td>
                      <td className="py-3 text-right font-mono text-[#9CA3AF]">
                        {s.durationSeconds < 60
                          ? `${s.durationSeconds}s`
                          : `${Math.floor(s.durationSeconds / 60)}m ${s.durationSeconds % 60}s`}
                      </td>
                      <td className="py-3 text-right font-mono text-emerald-400">
                        {s.lastSeenSecondsAgo}s trước
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6B7280] text-xs">
                      Không có phiên hoạt động nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CHI TIẾT LƯỢT XEM HÔM NAY (WHO VIEWED WHAT & WHEN) */}
      {/* ========================================================= */}
      {activeModal === "pageviews" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#2E2E2E] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FECF59]/10 border border-[#FECF59]/30 flex items-center justify-center text-[#FECF59]">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Lịch Sử Lượt Xem Hôm Nay
                    <span className="text-xs font-mono font-bold text-[#FECF59] bg-[#FECF59]/10 border border-[#FECF59]/30 px-2 py-0.5 rounded-full">
                      {stats?.todayStats.pageViews ?? 0} lượt
                    </span>
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Danh sách chi tiết từng lần mở trang: Ai xem, xem phim gì và vào lúc nào.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[#222222] bg-[#111111]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên người dùng, tên phim hoặc đường link..."
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-[#FECF59] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-[#6B7280] outline-none transition-colors"
                />
              </div>
            </div>

            {/* Table of Pageviews */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredPageViews.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#9CA3AF]">
                      <th className="pb-3 font-semibold">Người xem</th>
                      <th className="pb-3 font-semibold">Trang / Phim đã xem</th>
                      <th className="pb-3 font-semibold">Thiết bị</th>
                      <th className="pb-3 font-semibold text-right">Thời gian xem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {filteredPageViews.map((log) => (
                      <tr key={log.id} className="hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {log.userName || "Khách Vãng Lai"}
                            {log.userRole === "admin" && (
                              <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                                ADMIN
                              </span>
                            )}
                            {log.userRole === "vip" && (
                              <span className="text-[9px] bg-[#FECF59] text-black px-1.5 py-0.2 rounded font-bold">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#6B7280] font-mono">
                            ID: {log.sessionId.slice(0, 10)}...
                          </div>
                        </td>
                        <td className="py-3">
                          <div className="font-medium text-white text-xs">
                            {log.title || log.page}
                          </div>
                          <div className="text-[10px] text-[#9CA3AF] font-mono truncate max-w-[280px]">
                            {log.page}
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#D1D5DB] font-mono">
                            {log.device === "mobile" ? (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                                Mobile
                              </>
                            ) : (
                              <>
                                <Monitor className="w-3.5 h-3.5 text-purple-400" />
                                Desktop
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono text-[#FECF59] text-xs">
                          {formatTime(log.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-[#6B7280] text-xs">
                  Không tìm thấy lượt xem nào phù hợp
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262626] bg-[#111111] flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Hiển thị tối đa 100 lượt click gần nhất trong ngày</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DANH SÁCH KHÁCH TRUY CẬP HÔM NAY (WHO VISITED)   */}
      {/* ========================================================= */}
      {activeModal === "visitors" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#2E2E2E] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Danh Sách Khách Truy Cập Hôm Nay
                    <span className="text-xs font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-full">
                      {stats?.todayStats.uniqueVisitors ?? 0} khách
                    </span>
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Danh sách các người dùng / thiết bị riêng biệt đã ghé thăm trang web hôm nay.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-[#222222] bg-[#111111]">
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên người dùng hoặc Session ID..."
                  className="w-full bg-[#181818] border border-[#2E2E2E] focus:border-blue-500 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-[#6B7280] outline-none transition-colors"
                />
              </div>
            </div>

            {/* Visitors Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredVisitors.length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#9CA3AF]">
                      <th className="pb-3 font-semibold">Khách / Tài khoản</th>
                      <th className="pb-3 font-semibold">Thiết bị</th>
                      <th className="pb-3 font-semibold">Trang xem cuối</th>
                      <th className="pb-3 font-semibold text-center">Lượt xem</th>
                      <th className="pb-3 font-semibold text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {filteredVisitors.map((visitor) => (
                      <tr key={visitor.sessionId} className="hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {visitor.userName || "Khách Vãng Lai"}
                            {visitor.userRole === "admin" && (
                              <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                                ADMIN
                              </span>
                            )}
                            {visitor.userRole === "vip" && (
                              <span className="text-[9px] bg-[#FECF59] text-black px-1.5 py-0.2 rounded font-bold">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#6B7280] font-mono">
                            ID: {visitor.sessionId.slice(0, 12)}...
                          </div>
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#D1D5DB] font-mono">
                            {visitor.device === "mobile" ? (
                              <>
                                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                                Mobile
                              </>
                            ) : (
                              <>
                                <Monitor className="w-3.5 h-3.5 text-purple-400" />
                                Desktop
                              </>
                            )}
                          </span>
                        </td>
                        <td className="py-3">
                          <span
                            className="font-mono text-[#D1D5DB] truncate block max-w-[220px]"
                            title={visitor.lastPage}
                          >
                            {visitor.lastTitle || visitor.lastPage}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-mono font-bold text-white bg-[#222222] px-2 py-0.5 rounded text-[11px]">
                            {visitor.pageViewsCount} trang
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {visitor.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold font-mono text-[11px] bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Đang Online
                            </span>
                          ) : (
                            <span className="text-[#6B7280] font-mono text-[11px]">
                              Lần cuối: {formatTime(visitor.lastSeen)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-[#6B7280] text-xs">
                  Không tìm thấy khách truy cập nào
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262626] bg-[#111111] flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Tự động nhận diện thành viên đăng nhập và khách vãng lai</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: PHÂN BỔ THIẾT BỊ NGƯỜI DÙNG (DEVICE BREAKDOWN)  */}
      {/* ========================================================= */}
      {activeModal === "devices" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-[#2E2E2E] rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#262626] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Phân Bổ Người Dùng Theo Thiết Bị
                  </h3>
                  <p className="text-xs text-[#9CA3AF]">
                    Xem chính xác ai đang lướt bằng điện thoại và ai đang dùng máy tính.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="p-2 rounded-xl text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab Switcher */}
            <div className="p-4 border-b border-[#222222] bg-[#111111] flex items-center gap-3">
              <button
                onClick={() => setDeviceTab("mobile")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  deviceTab === "mobile"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10"
                    : "bg-[#181818] border-[#2A2A2A] text-[#9CA3AF] hover:text-white"
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Điện Thoại (Mobile)</span>
                <span className="font-mono bg-blue-500/20 px-2 py-0.2 rounded-full text-[10px]">
                  {mobileVisitors.length} khách
                </span>
              </button>

              <button
                onClick={() => setDeviceTab("desktop")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  deviceTab === "desktop"
                    ? "bg-purple-600/20 border-purple-500 text-purple-400 shadow-lg shadow-purple-500/10"
                    : "bg-[#181818] border-[#2A2A2A] text-[#9CA3AF] hover:text-white"
                }`}
              >
                <Monitor className="w-4 h-4" />
                <span>Máy Tính (Desktop)</span>
                <span className="font-mono bg-purple-500/20 px-2 py-0.2 rounded-full text-[10px]">
                  {desktopVisitors.length} khách
                </span>
              </button>
            </div>

            {/* Device Users Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {(deviceTab === "mobile" ? mobileVisitors : desktopVisitors).length > 0 ? (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#9CA3AF]">
                      <th className="pb-3 font-semibold">Người dùng</th>
                      <th className="pb-3 font-semibold">Phim / Trang xem gần nhất</th>
                      <th className="pb-3 font-semibold text-center">Lượt xem</th>
                      <th className="pb-3 font-semibold text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222222]">
                    {(deviceTab === "mobile" ? mobileVisitors : desktopVisitors).map((v) => (
                      <tr key={v.sessionId} className="hover:bg-[#1A1A1A] transition-colors">
                        <td className="py-3">
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            {v.userName || "Khách Vãng Lai"}
                            {v.userRole === "admin" && (
                              <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.2 rounded font-bold">
                                ADMIN
                              </span>
                            )}
                            {v.userRole === "vip" && (
                              <span className="text-[9px] bg-[#FECF59] text-black px-1.5 py-0.2 rounded font-bold">
                                VIP
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#6B7280] font-mono">
                            ID: {v.sessionId.slice(0, 12)}...
                          </div>
                        </td>
                        <td className="py-3">
                          <span
                            className="font-mono text-[#D1D5DB] truncate block max-w-[260px]"
                            title={v.lastPage}
                          >
                            {v.lastTitle || v.lastPage}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span className="font-mono font-bold text-white bg-[#222222] px-2 py-0.5 rounded text-[11px]">
                            {v.pageViewsCount} trang
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {v.isOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold font-mono text-[11px] bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Đang Online
                            </span>
                          ) : (
                            <span className="text-[#6B7280] font-mono text-[11px]">
                              {formatTime(v.lastSeen)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-[#6B7280] text-xs">
                  Chưa có người dùng nào thuộc nhóm thiết bị này hôm nay
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#262626] bg-[#111111] flex items-center justify-between text-xs text-[#9CA3AF]">
              <span>Phân loại tự động theo User Agent và kích thước màn hình</span>
              <button
                onClick={() => setActiveModal(null)}
                className="px-4 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
