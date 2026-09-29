"use client";

import * as React from "react";

import type { CommentViewModel } from "./comment-item";
import { CommentItem } from "./comment-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

interface CommentListProps {
  items: CommentViewModel[];
  isLoading: boolean;
  error: string | null;
  onReply: (parentId: string, authorName: string) => void;
  onReportOpen: (commentId: string) => void;
  onChanged: () => void;
}

export function CommentList({ items, isLoading, error, onReply, onReportOpen, onChanged }: CommentListProps) {
  if (error) {
    return (
      <p className="text-sm text-red-400 p-4 rounded-lg bg-red-500/10 border border-red-500/30" role="alert">
        {error}
      </p>
    );
  }
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Đang tải bình luận">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 py-3 border-b border-cinema-800 last:border-b-0">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="Chưa có bình luận nào"
        description="Hãy là người đầu tiên chia sẻ cảm nhận về bộ phim này."
      />
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
