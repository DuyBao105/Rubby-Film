"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Eye, EyeOff, Trash2, RotateCcw, ExternalLink, ChevronLeft, ChevronRight,
  Inbox, Loader2, AlertTriangle, ShieldAlert, X,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type ReportStatus = "open" | "reviewed" | "dismissed" | "actioned";
type ReportReason = "spam" | "abuse" | "harassment" | "inappropriate" | "spoiler" | "other";
type SortDir = "newest" | "oldest";

interface ReportView {
  id: string;
  commentId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: number;
  reporter: { id: string; name: string };
  comment: {
    id: string; content: string; movieId: string; isSpoiler: boolean;
    authorId: string; authorName: string; authorAvatarUrl: string | null;
  };
}
interface ReportListPage {
  items: ReportView[]; total: number; page: number; limit: number; totalPages: number;
}
interface StatusCounts { open: number; reviewed: number; dismissed: number; actioned: number; total: number; }

const STATUS_META: Record<ReportStatus, { label: string; badge: string; accent: string }> = {
  open:      { label: "Mới",         badge: "bg-[#E50000] text-white",                  accent: "border-[#E50000]/40 bg-gradient-to-br from-[#E50000]/15 to-transparent" },
  reviewed:  { label: "Đã xem",      badge: "bg-[#FECF59] text-black",                  accent: "border-[#FECF59]/40 bg-gradient-to-br from-[#FECF59]/15 to-transparent" },
  dismissed: { label: "Bỏ qua",      badge: "bg-[#404040] text-[#D1D5DB]",               accent: "border-[#404040] bg-gradient-to-br from-[#404040]/30 to-transparent" },
  actioned:  { label: "Đã xử lý",    badge: "bg-emerald-700 text-white",                 accent: "border-emerald-700/40 bg-gradient-to-br from-emerald-700/15 to-transparent" },
};
const REASON_META: Record<ReportReason, { label: string; icon: string }> = {
  spam:          { label: "Spam",         icon: "🚫" },
  abuse:         { label: "Lạm dụng",     icon: "⚠️" },
  harassment:    { label: "Quấy rối",     icon: "🛡️" },
  inappropriate: { label: "Không phù hợp", icon: "🔞" },
  spoiler:       { label: "Spoiler",      icon: "🎬" },
  other:         { label: "Khác",         icon: "📝" },
};
const STATUS_ORDER: ReportStatus[] = ["open", "reviewed", "dismissed", "actioned"];

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "vừa xong";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} phút`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} ngày`;
  return new Date(ms).toLocaleDateString("vi-VN");
}

function ConfirmDialog({
  open, title, description, confirmLabel, danger, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onCancel}>
      <div className="bg-[#171717] border border-[#262626] rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className={cn("p-2 rounded-full shrink-0", danger ? "bg-[#E50000]/15" : "bg-[#FECF59]/15")}>
            <AlertTriangle className={cn("w-5 h-5", danger ? "text-[#E50000]" : "text-[#FECF59]")} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#F9FAFB]">{title}</h3>
            <p className="mt-1 text-sm text-[#9CA3AF]">{description}</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Đóng" className="text-[#9CA3AF] hover:text-[#F9FAFB]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-4 py-2 text-sm rounded-lg bg-[#262626] text-[#D1D5DB] hover:bg-[#404040] transition-colors">Huỷ</button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn("px-4 py-2 text-sm rounded-lg font-semibold transition-colors",
              danger ? "bg-[#E50000] text-white hover:bg-[#B30000]" : "bg-[#FECF59] text-black hover:bg-[#E5B800]")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatsStrip({ counts, active, onSelect }: { counts: StatusCounts; active: ReportStatus | ""; onSelect: (s: ReportStatus | "") => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
      <button type="button" onClick={() => onSelect("")}
        className={cn("text-left p-4 rounded-xl border bg-gradient-to-br transition-all",
          active === "" ? "border-[#F9FAFB]/40 from-[#F9FAFB]/10 to-transparent ring-1 ring-[#F9FAFB]/20" : "border-[#262626] from-transparent to-transparent hover:border-[#404040]")}>
        <div className="text-xs text-[#9CA3AF] uppercase tracking-wider">Tất cả</div>
        <div className="text-2xl font-bold text-[#F9FAFB] mt-1 tabular-nums">{counts.total}</div>
      </button>
      {STATUS_ORDER.map((s) => (
        <button key={s} type="button" onClick={() => onSelect(s)}
          className={cn("text-left p-4 rounded-xl border bg-gradient-to-br transition-all",
            active === s ? STATUS_META[s].accent : "border-[#262626] from-transparent to-transparent hover:border-[#404040]")}>
          <div className="text-xs text-[#9CA3AF] uppercase tracking-wider flex items-center gap-1.5">
            <span className={cn("inline-block w-2 h-2 rounded-full",
              s === "open" ? "bg-[#E50000]" : s === "reviewed" ? "bg-[#FECF59]" : s === "actioned" ? "bg-emerald-500" : "bg-[#666]")} />
            {STATUS_META[s].label}
          </div>
          <div className="text-2xl font-bold text-[#F9FAFB] mt-1 tabular-nums">{counts[s]}</div>
        </button>
      ))}
    </div>
  );
}

function ReportCard({
  r, busy, onHide, onDelete, onMarkReviewed, onDismiss, onReopen,
}: {
  r: ReportView;
  busy: boolean;
  onHide: () => void;
  onDelete: () => void;
  onMarkReviewed: () => void;
  onDismiss: () => void;
  onReopen: () => void;
}) {
  const meta = STATUS_META[r.status];
  const isRemoved = r.comment.content === "[removed]";
  const isOpen = r.status === "open";
  return (
    <article className={cn("relative bg-[#171717] border rounded-xl p-4 transition-opacity",
      busy ? "opacity-60 pointer-events-none border-[#262626]" : "border-[#262626] hover:border-[#404040]")}>
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className={cn("px-2 py-0.5 rounded-full text-xs font-semibold shrink-0", meta.badge)}>{meta.label}</span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-[#262626] text-[#D1D5DB] shrink-0">
            <span aria-hidden>{REASON_META[r.reason].icon}</span> {REASON_META[r.reason].label}
          </span>
          <span className="text-xs text-[#9CA3AF]">• {timeAgo(r.createdAt)}</span>
        </div>
        <Link
          href={`/movie/${encodeURIComponent(r.comment.movieId)}#comment-${r.comment.id}`}
          className="inline-flex items-center gap-1 text-xs text-[#D1D5DB] hover:text-[#F9FAFB] shrink-0"
          title="Mở trong trang phim"
        >
          <ExternalLink className="w-3 h-3" /> Mở
        </Link>
      </header>

      <div className="flex gap-3">
        {r.comment.authorAvatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.comment.authorAvatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#E50000] to-[#7a0000] text-white flex items-center justify-center text-sm font-semibold shrink-0">
            {r.comment.authorName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-sm font-medium text-[#F9FAFB] truncate">{r.comment.authorName}</span>
            <span className="text-xs text-[#666]">báo cáo bởi <span className="text-[#9CA3AF]">{r.reporter.name}</span></span>
          </div>
          {isRemoved ? (
            <p className="text-sm italic text-[#666]">[Bình luận đã bị xoá]</p>
          ) : r.comment.isSpoiler ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-[#FECF59] select-none">⚠ Chứa spoiler — nhấn để hiện</summary>
              <p className="mt-2 text-[#F9FAFB] whitespace-pre-wrap break-words">{r.comment.content}</p>
            </details>
          ) : (
            <p className="text-sm text-[#F9FAFB] whitespace-pre-wrap break-words">{r.comment.content}</p>
          )}
          {r.description && (
            <p className="mt-2 text-xs text-[#9CA3AF] italic border-l-2 border-[#404040] pl-3">
              Mô tả thêm: {r.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-[#262626]">
        {isOpen && (
          <>
            <button type="button" onClick={onMarkReviewed} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#262626] text-[#FECF59] hover:bg-[#404040] transition-colors">
              <Eye className="w-3.5 h-3.5" /> Đánh dấu đã xem
            </button>
            <button type="button" onClick={onHide} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#FECF59] text-black font-semibold hover:bg-[#E5B800] transition-colors">
              <EyeOff className="w-3.5 h-3.5" /> Ẩn bình luận
            </button>
            <button type="button" onClick={onDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#E50000] text-white font-semibold hover:bg-[#B30000] transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Xoá vĩnh viễn
            </button>
            <button type="button" onClick={onDismiss} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#262626] text-[#D1D5DB] hover:bg-[#404040] transition-colors">
              Bỏ qua
            </button>
          </>
        )}
        {(r.status === "reviewed" || r.status === "dismissed" || r.status === "actioned") && (
          <button type="button" onClick={onReopen} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#262626] text-[#D1D5DB] hover:bg-[#404040] transition-colors">
            <RotateCcw className="w-3.5 h-3.5" /> Mở lại
          </button>
        )}
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-[#171717] border border-[#262626] rounded-xl p-4 animate-pulse">
          <div className="h-4 bg-[#262626] rounded w-1/3 mb-3" />
          <div className="flex gap-3">
            <div className="w-9 h-9 bg-[#262626] rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-[#262626] rounded w-1/4" />
              <div className="h-3 bg-[#262626] rounded w-full" />
              <div className="h-3 bg-[#262626] rounded w-5/6" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ModerationPage() {
  const [data, setData] = useState<ReportListPage | null>(null);
  const [counts, setCounts] = useState<StatusCounts>({ open: 0, reviewed: 0, dismissed: 0, actioned: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "">("");
  const [reasonFilter, setReasonFilter] = useState<ReportReason | "">("");
  const [sortDir, setSortDir] = useState<SortDir>("newest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { reportId: string; kind: "delete" | "hide" }>(null);

  const toast = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      if (reasonFilter) params.set("reason", reasonFilter);
      params.set("sort", sortDir);
      const [listRes, countsRes] = await Promise.all([
        fetch(`/api/admin/moderation/reports?${params}`, { signal: ctl.signal }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) })),
        fetch(`/api/admin/moderation/reports/counts`, { signal: ctl.signal }).then(async (r) => ({ ok: r.ok, j: await r.json().catch(() => null) })).catch(() => ({ ok: false, j: null })),
      ]);
      if (!listRes.ok || !listRes.j?.success) throw new Error(listRes.j?.error?.message ?? "Lỗi tải báo cáo");
      setData(listRes.j.data);
      if (countsRes.ok && countsRes.j?.success) setCounts(countsRes.j.data);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, reasonFilter, sortDir]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: SSE via EventSource, reconnect on error.
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const refetchAll = () => {
      if (cancelled) return;
      void load();
    };

    const connect = () => {
      if (cancelled) return;
      es = new EventSource("/api/admin/moderation/stream", { withCredentials: true });
      es.addEventListener("report.created", refetchAll);
      es.addEventListener("report.updated", refetchAll);
      es.addEventListener("end", () => {
        es?.close();
        if (!cancelled) reconnectTimer = setTimeout(connect, 1000);
      });
      es.onerror = () => {
        es?.close();
        if (!cancelled) reconnectTimer = setTimeout(connect, 3000);
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      es?.close();
    };
  }, [load]);

  const runAction = useCallback(async (
    reportId: string, status: ReportStatus, action: "hide" | "delete" | null,
  ) => {
    setBusyId(reportId);
    try {
      const res = await fetch(`/api/admin/moderation/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, action }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.success) throw new Error(j?.error?.message ?? "Thao tác thất bại");
      toast.success(
        action === "delete" ? "Đã xoá vĩnh viễn" : action === "hide" ? "Đã ẩn bình luận" : "Đã cập nhật trạng thái",
      );
      await load();
    } catch (e) {
      toast.error("Thao tác thất bại", e instanceof Error ? e.message : undefined);
      await load();
    } finally {
      setBusyId(null);
    }
  }, [load, toast]);

  const handleAction = useCallback((reportId: string, kind: "delete" | "hide") => {
    if (kind === "delete") {
      setConfirm({ reportId, kind });
    } else {
      void runAction(reportId, "actioned", "hide");
    }
  }, [runAction]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const showEmpty = !loading && items.length === 0;

  const activeReasons = useMemo<ReportReason[]>(
    () => Array.from(new Set(items.map((i) => i.reason))) as ReportReason[],
    [items],
  );

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-[#F9FAFB] px-4 pt-28 sm:pt-32 pb-20">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1 text-xs text-[#D1D5DB] hover:text-[#F9FAFB]">
            ← Trang chủ
          </Link>
          <div className="flex items-center gap-2 mt-1">
            <ShieldAlert className="w-6 h-6 text-[#E50000]" />
            <h1 className="text-2xl font-bold">Kiểm duyệt bình luận</h1>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1">Quản lý báo cáo từ người dùng về bình luận vi phạm.</p>
        </header>

        <StatsStrip counts={counts} active={statusFilter} onSelect={(s) => { setPage(1); setStatusFilter(s); }} />

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="inline-flex rounded-lg border border-[#262626] overflow-hidden">
            <button type="button" onClick={() => setSortDir("newest")}
              className={cn("px-3 py-1.5 text-xs", sortDir === "newest" ? "bg-[#F9FAFB] text-black font-semibold" : "bg-[#171717] text-[#D1D5DB] hover:bg-[#262626]")}>
              Mới nhất
            </button>
            <button type="button" onClick={() => setSortDir("oldest")}
              className={cn("px-3 py-1.5 text-xs border-l border-[#262626]", sortDir === "oldest" ? "bg-[#F9FAFB] text-black font-semibold" : "bg-[#171717] text-[#D1D5DB] hover:bg-[#262626]")}>
              Cũ nhất
            </button>
          </div>

          {activeReasons.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#9CA3AF] mr-1">Lý do:</span>
              <button type="button" onClick={() => { setPage(1); setReasonFilter(""); }}
                className={cn("inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors",
                  reasonFilter === "" ? "border-[#F9FAFB]/40 bg-[#F9FAFB]/10 text-[#F9FAFB]" : "border-[#262626] text-[#D1D5DB] hover:border-[#404040]")}>
                Tất cả
              </button>
              {activeReasons.map((r) => (
                <button key={r} type="button" onClick={() => { setPage(1); setReasonFilter(r); }}
                  className={cn("inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border transition-colors",
                    reasonFilter === r ? "border-[#FECF59]/50 bg-[#FECF59]/10 text-[#FECF59]" : "border-[#262626] text-[#D1D5DB] hover:border-[#404040]")}>
                  <span aria-hidden>{REASON_META[r].icon}</span> {REASON_META[r].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-900 text-red-200 text-sm">
            {error}
          </div>
        )}

        {loading && !data ? <Skeleton /> : showEmpty ? (
          <div className="text-center py-16 border border-dashed border-[#262626] rounded-xl">
            <Inbox className="w-12 h-12 mx-auto text-[#404040] mb-3" />
            <p className="text-sm text-[#9CA3AF]">Không có báo cáo nào.</p>
            {(statusFilter || reasonFilter) && (
              <button type="button" onClick={() => { setStatusFilter(""); setReasonFilter(""); }}
                className="mt-3 text-xs text-[#FECF59] hover:underline">
                Xoá bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <ReportCard
                key={r.id}
                r={r}
                busy={busyId === r.id}
                onHide={() => handleAction(r.id, "hide")}
                onDelete={() => handleAction(r.id, "delete")}
                onMarkReviewed={() => runAction(r.id, "reviewed", null)}
                onDismiss={() => runAction(r.id, "dismissed", null)}
                onReopen={() => runAction(r.id, "open", null)}
              />
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#171717] border border-[#262626] disabled:opacity-40 hover:border-[#404040]">
              <ChevronLeft className="w-3.5 h-3.5" /> Trước
            </button>
            <span className="text-xs text-[#9CA3AF] tabular-nums">Trang {data.page}/{data.totalPages}</span>
            <button type="button" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-[#171717] border border-[#262626] disabled:opacity-40 hover:border-[#404040]">
              Sau <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading && data && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[#9CA3AF]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải...
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirm !== null}
        title="Xoá bình luận vĩnh viễn?"
        description="Hành động này không thể hoàn tác. Bình luận sẽ bị xoá hoàn toàn khỏi hệ thống cùng mọi lượt thích liên quan."
        confirmLabel="Xoá vĩnh viễn"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          const id = confirm.reportId;
          setConfirm(null);
          void runAction(id, "actioned", "delete");
        }}
      />
    </main>
  );
}
