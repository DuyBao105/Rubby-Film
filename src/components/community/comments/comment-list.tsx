"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import type { CommentViewModel } from "./comment-item";
import { CommentItem } from "./comment-item";

interface CommentListProps {
  items: CommentViewModel[];
  isLoading: boolean;
  error: string | null;
  onReply: (parentId: string, authorName: string) => void;
  onReportOpen: (commentId: string) => void;
  onChanged: () => void;
}

export function CommentList({
  items,
  isLoading,
  error,
  onReply,
  onReportOpen,
  onChanged,
}: CommentListProps) {
  if (error) {
    return (
      <p
        className="text-sm text-red-400 p-4 rounded-lg bg-red-500/10 border border-red-500/30"
        role="alert"
      >
        {error}
      </p>
    );
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Đang tải bình luận">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-cinema-800 last:border-b-0 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-cinema-800/80 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 bg-cinema-800/80 rounded" />
              <div className="h-3 w-full bg-cinema-800/80 rounded" />
              <div className="h-3 w-3/4 bg-cinema-800/80 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-cinema-800 bg-cinema-950/40 my-2">
        <div className="w-12 h-12 rounded-full bg-cinema-800/60 border border-cinema-700/50 flex items-center justify-center text-cinema-400 mb-3 shadow-inner">
          <MessageSquare className="w-6 h-6 text-cinema-400" />
        </div>
        <p className="text-sm font-semibold text-cinema-200">Chưa có bình luận nào</p>
        <p className="text-xs text-cinema-400 mt-1 max-w-sm">
          Hãy là người đầu tiên chia sẻ cảm nhận về bộ phim này.
        </p>
      </div>
    );
  }

  return (
    <div role="feed" aria-busy={isLoading ? "true" : undefined} aria-label="Danh sách bình luận">
      {items.map((c) => (
        <CommentItem
          key={c.id}
          c={c}
          onReply={onReply}
          onReportOpen={onReportOpen}
          onChanged={onChanged}
          canReply
        />
      ))}
    </div>
  );
}
