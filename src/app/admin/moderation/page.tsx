"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ReportView {
  id: string;
  commentId: string;
  reason: string;
  description: string | null;
  status: "open" | "reviewed" | "dismissed" | "actioned";
  createdAt: number;
  reporter: { id: string; name: string };
  comment: { id: string; content: string; movieId: string; isSpoiler: boolean; authorId: string };
}

interface ReportListPage {
  items: ReportView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STATUS_LABELS: Record<ReportView["status"], string> = {
  open: "Mới",
  reviewed: "Đã xem",
  dismissed: "Bỏ qua",
  actioned: "Đã xử lý",
};

const STATUS_STYLES: Record<ReportView["status"], string> = {
  open: "bg-[#E50000] text-white",
  reviewed: "bg-[#FECF59] text-black",
  dismissed: "bg-[#404040] text-[#D1D5DB]",
  actioned: "bg-green-700 text-white",
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "vừa xong";
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const d = Math.floor(hr / 24);
  return `${d} ngày trước`;
}

export default function ModerationPage() {
  const [data, setData] = useState<ReportListPage | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportView["status"] | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/moderation/reports?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message ?? "Lỗi tải báo cáo");
      }
      setData(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { void load(); }, [load]);

  async function act(reportId: string, status: "dismissed" | "actioned", action?: "hide" | "delete") {
    if (data) {
      setData({
        ...data,
        items: data.items.map((r) =>
          r.id === reportId
            ? { ...r, status, comment: action ? { ...r.comment, content: "[removed]" } : r.comment }
            : r,
        ),
      });
    }
    try {
      const res = await fetch(`/api/admin/moderation/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, action: action ?? null }),
      });
      if (!res.ok) throw new Error("Action thất bại");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action thất bại");
      await load();
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F9FAFB] px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <Link href="/" className="text-xs text-[#D1D5DB] hover:text-[#F9FAFB]">← Trang chủ</Link>
            <h1 className="text-2xl font-bold mt-1">Kiểm duyệt bình luận</h1>
            {data && <p className="text-xs text-[#9CA3AF] mt-1">{data.total} báo cáo</p>}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setPage(1); setStatusFilter(e.target.value as ReportView["status"] | ""); }}
            className="bg-[#171717] border border-[#262626] rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tất cả</option>
            <option value="open">Mới</option>
            <option value="reviewed">Đã xem</option>
            <option value="dismissed">Bỏ qua</option>
            <option value="actioned">Đã xử lý</option>
          </select>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-900 text-red-200 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="text-[#9CA3AF] text-sm">Đang tải...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="text-[#9CA3AF] text-sm py-12 text-center border border-dashed border-[#262626] rounded-xl">
            Không có báo cáo nào.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((r) => (
              <article key={r.id} className="bg-[#171717] border border-[#262626] rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                    <span className={`px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                    <span>•</span>
                    <span>{timeAgo(r.createdAt)}</span>
                    <span>•</span>
                    <span>bởi <strong className="text-[#D1D5DB]">{r.reporter.name}</strong></span>
                  </div>
                  <span className="text-xs bg-[#262626] text-[#D1D5DB] px-2 py-0.5 rounded">{r.reason}</span>
                </div>
                <p className="text-sm text-[#F9FAFB] mb-2 whitespace-pre-wrap">
                  {r.comment.content}
                </p>
                {r.description && (
                  <p className="text-xs text-[#9CA3AF] italic mb-3 border-l-2 border-[#404040] pl-3">
                    Mô tả: {r.description}
                  </p>
                )}
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button type="button" onClick={() => act(r.id, "actioned", "hide")} className="px-3 py-1.5 text-xs rounded-lg bg-[#FECF59] text-black font-semibold hover:bg-[#E5B800] transition-colors">Ẩn bình luận</button>
                    <button type="button" onClick={() => act(r.id, "actioned", "delete")} className="px-3 py-1.5 text-xs rounded-lg bg-[#E50000] text-white font-semibold hover:bg-[#B30000] transition-colors">Xóa vĩnh viễn</button>
                    <button type="button" onClick={() => act(r.id, "dismissed")} className="px-3 py-1.5 text-xs rounded-lg bg-[#262626] text-[#D1D5DB] font-medium hover:bg-[#404040] transition-colors">Bỏ qua</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 text-xs rounded-lg bg-[#171717] border border-[#262626] disabled:opacity-50">Trước</button>
            <span className="text-xs text-[#9CA3AF]">Trang {data.page}/{data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 text-xs rounded-lg bg-[#171717] border border-[#262626] disabled:opacity-50">Sau</button>
          </div>
        )}
      </div>
    </main>
  );
}