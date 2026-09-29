"use client";

import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "abuse", label: "Quấy rối / Ngôn từ xúc phạm" },
  { value: "harassment", label: "Quấy rối có hệ thống" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "spoiler", label: "Chứa spoiler không ghi chú" },
  { value: "other", label: "Khác" },
] as const;

interface ReportModalProps {
  commentId: string | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (commentId: string, reason: string, description: string) => Promise<{ ok: boolean; message?: string }>;
  /** Toast hook — passed in to keep component decoupled from providers. */
  notify?: (result: { ok: boolean; message?: string }) => void;
}

export function ReportModal({ commentId, open, onClose, onSubmit, notify }: ReportModalProps) {
  const [reason, setReason] = React.useState<string>("spam");
  const [desc, setDesc] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastFocus = React.useRef<HTMLElement | null>(null);

  // Focus trap + Esc close. Restore focus to opener.
  React.useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const focusable = () =>
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a, button, input, textarea, [tabindex]:not([tabindex="-1"])',
      );
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Tab" && focusable()) {
        const list = Array.from(focusable()!);
        if (list.length === 0) return;
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => focusable()?.[0]?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [open, onClose]);

  if (!open || !commentId) return null;

  const submit = async () => {
    setSubmitting(true);
    const result = await onSubmit(commentId, reason, desc.trim());
    setSubmitting(false);
    notify?.(result);
    if (result.ok) {
      setDesc("");
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Báo cáo bình luận"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={cn(
          "bg-cinema-900 border border-cinema-700 rounded-xl p-5 w-full max-w-md space-y-3",
          "shadow-2xl shadow-black/60",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-cinema-100 font-semibold">Báo cáo bình luận</h3>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="p-1 rounded text-cinema-400 hover:text-cinema-100 hover:bg-cinema-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5 text-sm text-cinema-200">
          {REASONS.map((r) => (
            <label
              key={r.value}
              className={cn(
                "flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-cinema-800/60",
                reason === r.value && "bg-cinema-800",
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-brand"
              />
              <span>{r.label}</span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="report-desc" className="block text-xs text-cinema-400 mb-1">
            Mô tả thêm (tuỳ chọn, tối đa 500 ký tự)
          </label>
          <textarea
            id="report-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="Mô tả thêm..."
            className={cn(
              "w-full bg-cinema-950 border border-cinema-700 rounded p-2 text-cinema-100 text-sm",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-cinema-500",
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded text-cinema-300 hover:bg-cinema-800 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="px-3 py-1.5 rounded bg-brand text-white font-semibold hover:bg-[#FF1A1A] disabled:opacity-50"
          >
            {submitting ? "Đang gửi..." : "Gửi báo cáo"}
          </button>
        </div>
      </div>
    </div>
  );
}
