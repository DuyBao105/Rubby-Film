"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  Users,
  Smartphone,
  Monitor,
  Eye,
  Activity,
  ChevronRight,
  ExternalLink,
  X,
  Radio,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/use-auth";
import type { RealtimeAnalyticsStats } from "@/lib/server/presenceTracker";

export function AdminLivePresenceBadge() {
  const { user } = useAuth();
  const [stats, setStats] = useState<RealtimeAnalyticsStats | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let es: EventSource | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    let isCancelled = false;

    // Fast initial fetch
    const fetchDirect = async () => {
      try {
        const res = await fetch("/api/admin/analytics/realtime");
        if (res.ok) {
          const json = await res.json();
          if (json.ok && json.data && !isCancelled) {
            setStats(json.data);
          }
        }
      } catch {}
    };

    fetchDirect();

    // Setup Sub-second Realtime SSE Connection
    const connectStream = () => {
      try {
        es = new EventSource("/api/admin/analytics/stream");

        es.addEventListener("presence", (event) => {
          try {
            const data: RealtimeAnalyticsStats = JSON.parse(event.data);
            if (!isCancelled && data) {
              setStats(data);
              setIsLiveConnected(true);
            }
          } catch {}
        });

        es.addEventListener("error", () => {
          setIsLiveConnected(false);
          if (es) {
            es.close();
            es = null;
          }
          // Reconnect stream after 3s
          if (!isCancelled) {
            setTimeout(connectStream, 3000);
          }
        });
      } catch {
        // Fallback to polling every 3 seconds if SSE fails
        fallbackTimer = setInterval(fetchDirect, 3000);
      }
    };

    connectStream();

    return () => {
      isCancelled = true;
      if (es) es.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [isAdmin]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!isAdmin) {
    return null;
  }

  const activeCount = stats?.totalActive ?? 0;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Live Badge Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title="Live Real-time Visitors (Chỉ Admin thấy)"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/80 shadow-[0_0_14px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all cursor-pointer select-none group"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="font-mono font-bold tracking-tight text-[11px] sm:text-xs">
          {activeCount}
        </span>
        <span className="hidden sm:inline text-[11px] text-emerald-300/80 group-hover:text-emerald-200">
          live
        </span>
      </button>

      {/* Floating Detailed Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2.5 w-[320px] sm:w-[350px] bg-[#141414]/95 backdrop-blur-xl border border-[#2A2A2A] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-4 z-50 animate-in fade-in zoom-in-95 duration-200 text-[#F9FAFB]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Real-time Traffic
                  <span className="text-[9px] bg-red-600/90 text-white font-extrabold px-1.5 py-0.2 rounded uppercase">
                    Admin
                  </span>
                </h4>
                <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Stream trực tiếp tức thì
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[#9CA3AF] hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 my-3">
            {/* Total Online */}
            <div className="bg-[#1C1C1C] border border-[#282828] rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[#9CA3AF] text-[11px] mb-1">
                <span>Đang online</span>
                <Users className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono">
                {stats?.totalActive ?? 0}
              </div>
              <div className="text-[10px] text-[#6B7280] mt-0.5">
                {stats?.members ?? 0} t.viên • {stats?.guests ?? 0} khách
              </div>
            </div>

            {/* Devices */}
            <div className="bg-[#1C1C1C] border border-[#282828] rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[#9CA3AF] text-[11px] mb-1">
                <span>Thiết bị</span>
                <Monitor className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="flex items-center gap-3 text-sm font-bold font-mono mt-1 text-white">
                <span className="flex items-center gap-1 text-blue-400">
                  <Smartphone className="w-3.5 h-3.5" />
                  {stats?.devices.mobile ?? 0}
                </span>
                <span className="text-[#4B5563]">/</span>
                <span className="flex items-center gap-1 text-purple-400">
                  <Monitor className="w-3.5 h-3.5" />
                  {stats?.devices.desktop ?? 0}
                </span>
              </div>
              <div className="text-[10px] text-[#6B7280] mt-0.5">
                Mobile / Desktop
              </div>
            </div>
          </div>

          {/* Today Summary */}
          {stats?.todayStats && (
            <div className="bg-[#181818] border border-[#262626] rounded-xl p-2.5 mb-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-[#9CA3AF]">
                <Eye className="w-3.5 h-3.5 text-[#FECF59]" />
                <span>Hôm nay:</span>
              </div>
              <div className="font-mono font-bold text-white text-[11px]">
                <span className="text-[#FECF59]">{stats.todayStats.pageViews}</span> lượt xem •{" "}
                <span className="text-emerald-400">{stats.todayStats.uniqueVisitors}</span> khách
              </div>
            </div>
          )}

          {/* Active Pages Right Now */}
          <div className="mb-3">
            <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Trang đang có người xem</span>
              <span className="text-[10px] text-emerald-400 font-mono">
                {stats?.topPages?.length || 0} trang
              </span>
            </div>
            <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1">
              {stats?.topPages && stats.topPages.length > 0 ? (
                stats.topPages.slice(0, 4).map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[#1A1A1A] hover:bg-[#222222] px-2.5 py-1.5 rounded-lg text-xs transition-colors"
                  >
                    <span className="truncate max-w-[210px] text-[#D1D5DB] font-mono text-[11px]">
                      {p.title || p.page}
                    </span>
                    <span className="ml-2 font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[10px]">
                      {p.count}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-[#6B7280] text-xs">
                  Chưa có dữ liệu trang
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="pt-2 border-t border-[#262626] space-y-1">
            <Link
              href="/admin/analytics"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-400 hover:text-emerald-300 text-xs font-semibold transition-all group"
            >
              <span>Xem Dashboard Thống Kê Chi Tiết</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link
              href="/admin/moderation"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-between w-full px-3 py-1.5 rounded-xl hover:bg-white/5 text-[#9CA3AF] hover:text-white text-xs transition-colors"
            >
              <span>Trang Kiểm Duyệt</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
