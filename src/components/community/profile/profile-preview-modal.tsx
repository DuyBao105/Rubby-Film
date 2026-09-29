"use client";

import { X } from "lucide-react";
import * as React from "react";

import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfilePreview } from "@/hooks/use-community";
import { cn } from "@/lib/utils";

interface ProfilePreviewModalProps {
  userId: string | null;
  onClose: () => void;
}

export function ProfilePreviewModal({ userId, onClose }: ProfilePreviewModalProps) {
  const { data, isLoading, error } = useProfilePreview(userId);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastFocus = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    lastFocus.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    setTimeout(() => dialogRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [userId, onClose]);

  if (!userId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Hồ sơ người dùng"
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={cn(
          "bg-cinema-900 border border-cinema-700 rounded-xl p-5 w-full max-w-sm shadow-2xl shadow-black/60",
          "focus:outline-none",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end">
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="p-1 rounded text-cinema-400 hover:text-cinema-100 hover:bg-cinema-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {!data && isLoading && (
          <div className="flex flex-col items-center gap-2 text-center py-2">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400 text-center" role="alert">
            {error}
          </p>
        )}
        {data && (
          <div className="flex flex-col items-center gap-2 text-center pt-1">
            <Avatar
              src={data.avatarUrl}
              alt={data.name}
              fallbackInitials={data.name?.slice(0, 2)?.toUpperCase() ?? "?"}
              size="lg"
              className="!w-16 !h-16"
            />
            <div className="font-semibold text-cinema-100">{data.name}</div>
            <div className="text-xs text-cinema-400 flex items-center justify-center gap-2">
              {data.role !== "user" && (
                <span
                  className={cn(
                    "px-1.5 rounded font-bold uppercase tracking-wider",
                    data.role === "admin"
                      ? "bg-brand/20 text-brand border border-brand/40"
                      : "bg-amber-500/15 text-amber-300 border border-amber-500/30",
                  )}
                >
                  {data.role}
                </span>
              )}
              <span>Gia nhập {new Date(data.createdAt).toLocaleDateString("vi-VN")}</span>
            </div>
            <div className="text-sm text-cinema-300 mt-1">{data.commentCount} bình luận</div>
          </div>
        )}
      </div>
    </div>
  );
}
